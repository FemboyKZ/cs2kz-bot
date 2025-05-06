const { Events } = require("discord.js");
const mongoose = require("mongoose");
require("dotenv").config();

const { MONGODB_URI, SESSION_ID } = process.env;

// mongoose global cfg
mongoose.set("strictQuery", false);
mongoose.set("debug", false);

/**
 * Establishes MongoDB connection
 * @param {Client} client Discord client instance
 */
async function connectToDatabase(client) {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI is not defined in environment variables");
    return client.gracefulShutdown();
  }

  if (mongoose.connection.readyState !== 0) {
    console.warn(
      `MongoDB connection already in state: ${mongoose.connection.readyState}`,
    );
    return;
  }

  try {
    console.log("Attempting MongoDB connection...");
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 3000,
    });
    console.log("MongoDB connection established");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    client.gracefulShutdown();
  }
}

module.exports = {
  name: Events.ClientReady,
  async execute(client) {
    console.log(`Client ready as ${client.user.tag} (${client.user.id})`);

    await connectToDatabase(client);
  },
};
