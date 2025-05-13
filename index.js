const express = require("express");
const axios = require("axios");
const querystring = require("querystring");
require("dotenv").config();

const app = express();
const PORT = 3000;

let access_token = "";
let refresh_token = "";

app.get("/login", (req, res) => {
  const scope = "user-top-read user-read-recently-played playlist-modify-public";
  const authURL =
    "https://accounts.spotify.com/authorize?" +
    querystring.stringify({
      client_id: process.env.CLIENT_ID,
      response_type: "code",
      redirect_uri: process.env.REDIRECT_URI,
      scope: scope,
    });
  res.redirect(authURL);
});

app.get("/callback", async (req, res) => {
  const code = req.query.code || null;

  try {
    const tokenResponse = await axios.post(
      "https://accounts.spotify.com/api/token",
      querystring.stringify({
        code,
        redirect_uri: process.env.REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              `${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`
            ).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    access_token = tokenResponse.data.access_token;
    refresh_token = tokenResponse.data.refresh_token;

    res.send(`
      <h2>Login Successful!</h2>
      <a href="/create-playlist">Click here to generate playlist from your recent plays</a>
    `);
  } catch (err) {
    console.error(err.response?.data || err);
    res.send("Error getting tokens");
  }
});

app.get("/create-playlist", async (req, res) => {
  try {
    // Step 1: Get user profile
    const userProfile = await axios.get("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const user_id = userProfile.data.id;

    // Step 2: Get recently played tracks
    const recentTracks = await axios.get(
      "https://api.spotify.com/v1/me/player/recently-played?limit=50",
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    // Step 3: Extract unique track URIs
    const uniqueURIs = [
      ...new Set(recentTracks.data.items.map((item) => item.track.uri)),
    ];

    // Take first 10 unique songs
    const recommendedURIs = uniqueURIs.slice(0, 10);

    if (recommendedURIs.length === 0) {
      return res.send("<h2>No recently played tracks found.</h2>");
    }

    // Step 4: Create a new playlist
    const playlist = await axios.post(
      `https://api.spotify.com/v1/users/${user_id}/playlists`,
      {
        name: "RecomML - Recent Tracks",
        description: "Based on your recent plays",
        public: true,
      },
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    const playlist_id = playlist.data.id;

    // Step 5: Add tracks to the playlist
    await axios.post(
      `https://api.spotify.com/v1/playlists/${playlist_id}/tracks`,
      {
        uris: recommendedURIs,
      },
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    res.send(`<h2>Playlist Created Successfully!</h2>
              <p><a href="https://open.spotify.com/playlist/${playlist_id}" target="_blank">View on Spotify</a></p>`);
  } catch (err) {
    console.error(err.response?.data || err);
    res.send("Failed to create playlist");
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
});
