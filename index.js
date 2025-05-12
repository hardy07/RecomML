require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
const port = 3000;

// Your Spotify credentials from the .env file
const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = process.env;

// Step 1: Redirect user to Spotify authorization URL
app.get("/login", (req, res) => {
  const scope =
    "user-library-read user-top-read playlist-modify-public playlist-modify-private"; // Modify as needed
  const state = "random_state_string"; // Optional but recommended for security

  const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&scope=${encodeURIComponent(scope)}&state=${state}`;

  res.redirect(authUrl);
});

// Step 2: Handle the Spotify callback
app.get("/callback", async (req, res) => {
  const { code } = req.query; // Authorization code from Spotify

  if (!code) {
    return res.send("Error: No authorization code received");
  }

  // Step 3: Exchange authorization code for access and refresh tokens
  try {
    const tokenResponse = await axios.post(
      "https://accounts.spotify.com/api/token",
      null,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${CLIENT_ID}:${CLIENT_SECRET}`
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        params: {
          code,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        },
      }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    // Store the tokens somewhere secure, e.g., session or database
    res.send(
      `Access Token: ${access_token}<br>Refresh Token: ${refresh_token}`
    );
  } catch (error) {
    console.error(error);
    res.send("Error while exchanging code for tokens");
  }
});

// Step 4: Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
