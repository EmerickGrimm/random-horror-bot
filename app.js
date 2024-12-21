const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Load environment variables from .env file
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID; // User ID of the bot admin for alerts

// Initialize the Telegram bot
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Track daily API call count
let dailyApiCalls = 0;
const MAX_API_CALLS = 1000;
let lastResetDate = new Date().toDateString();

function resetDailyApiCalls() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dailyApiCalls = 0;
    lastResetDate = today;
  }
}

// Function to fetch a random horror movie from OMDb
async function getRandomHorrorMovie() {
  try {
    resetDailyApiCalls();
    if (dailyApiCalls >= MAX_API_CALLS) {
      throw new Error('Daily API call limit reached');
    }

    // Generate a random year between 1950 and the current year
    const currentYear = new Date().getFullYear();
    const randomYear = Math.floor(Math.random() * (currentYear - 1950 + 1)) + 1950;

    // Fetch a random horror movie from OMDb
    const response = await axios.get(`http://www.omdbapi.com/`, {
      params: {
        apikey: OMDB_API_KEY,
        s: 'horror',
        type: 'movie',
        y: randomYear,
      },
    });

    dailyApiCalls++;

    const movies = response.data.Search;
    if (movies && movies.length > 0) {
      const randomIndex = Math.floor(Math.random() * movies.length);
      const movie = movies[randomIndex];

      // Fetch detailed information about the selected movie
      const movieDetailsResponse = await axios.get(`http://www.omdbapi.com/`, {
        params: {
          apikey: OMDB_API_KEY,
          i: movie.imdbID,
        },
      });

      dailyApiCalls++;

      const movieDetails = movieDetailsResponse.data;

      return {
        title: movieDetails.Title,
        plot: movieDetails.Plot,
        release_date: movieDetails.Released,
        poster: movieDetails.Poster !== 'N/A' ? movieDetails.Poster : null,
      };
    } else {
      throw new Error('No movies found');
    }
  } catch (error) {
    console.error('Error fetching horror movie:', error);
    if (ADMIN_USER_ID) {
      bot.sendMessage(ADMIN_USER_ID, `⚠️ Error fetching horror movie: ${error.message}`);
    }
    throw error;
  }
}

// Listen for the /horrormovie command
bot.onText(/\/horrormovie/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const movie = await getRandomHorrorMovie();

    let message = `\uD83D\uDD2A *${movie.title}*\n`;
    message += `Release Date: ${movie.release_date || 'Unknown'}\n\n`;
    message += `${movie.plot || 'No description available.'}`;

    if (movie.poster) {
      bot.sendPhoto(chatId, movie.poster, { caption: message, parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    bot.sendMessage(chatId, error.message.includes('Daily API call limit')
      ? 'Sorry, the bot has reached its daily API call limit. Please try again tomorrow.'
      : 'Sorry, I couldn\'t find a horror movie right now. Please try again later.');
  }
});

// Start message
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Welcome! Use /horrormovie to get a random horror movie suggestion.');
});
