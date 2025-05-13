const express = require("express");
const axios = require("axios");
const querystring = require("querystring");
const MusicRecommender = require("./model");
require("dotenv").config();

const app = express();
const PORT = 3000;

let access_token = "";
let refresh_token = "";
const recommender = new MusicRecommender();
let isModelTrained = false;

// Add a function to refresh the access token
async function refreshAccessToken() {
  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      querystring.stringify({
        grant_type: "refresh_token",
        refresh_token: refresh_token,
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
    access_token = response.data.access_token;
    if (response.data.refresh_token) {
      refresh_token = response.data.refresh_token;
    }
    return true;
  } catch (error) {
    console.error("Error refreshing token:", error.response?.data || error);
    return false;
  }
}

app.get("/login", (req, res) => {
  const scope = [
    "user-read-recently-played",
    "playlist-modify-public",
    "user-top-read",
    "user-read-private",
    "user-read-email",
    "user-library-read",
  ].join(" ");

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
      <p><a href="/train-model">First, click here to train the recommendation model</a></p>
    `);
  } catch (err) {
    console.error(err.response?.data || err);
    res.send("Error getting tokens");
  }
});

app.get("/train-model", async (req, res) => {
  try {
    if (!access_token) {
      return res.redirect("/login");
    }

    // Get user's saved tracks and recently played tracks for training
    const [savedTracks, recentTracks] = await Promise.all([
      axios.get("https://api.spotify.com/v1/me/tracks?limit=50", {
        headers: { Authorization: `Bearer ${access_token}` },
      }),
      axios.get(
        "https://api.spotify.com/v1/me/player/recently-played?limit=50",
        {
          headers: { Authorization: `Bearer ${access_token}` },
        }
      ),
    ]);

    // Combine and deduplicate tracks
    const savedTrackItems = savedTracks.data.items.map((item) => item.track);
    const recentTrackItems = recentTracks.data.items.map((item) => item.track);
    const allTracks = [...savedTrackItems, ...recentTrackItems];
    const uniqueTracks = Array.from(
      new Map(allTracks.map((track) => [track.id, track])).values()
    );

    console.log(`Training model with ${uniqueTracks.length} tracks...`);
    await recommender.train(uniqueTracks);
    isModelTrained = true;

    res.send(`
      <h2>Model Training Complete!</h2>
      <p>Trained on ${uniqueTracks.length} unique tracks.</p>
      <p><a href="/create-playlist">Click here to generate a personalized playlist</a></p>
    `);
  } catch (err) {
    console.error("Error training model:", err.response?.data || err);
    res.send("Error training model. Please try again.");
  }
});

app.get("/create-playlist", async (req, res) => {
  try {
    if (!access_token) {
      return res.redirect("/login");
    }

    if (!isModelTrained) {
      return res.redirect("/train-model");
    }

    // Get user profile
    const userProfile = await axios.get("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const user_id = userProfile.data.id;

    // Get recently played tracks as seed
    const recentTracks = await axios.get(
      "https://api.spotify.com/v1/me/player/recently-played?limit=10",
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    const seedTracks = recentTracks.data.items.map((item) => item.track);
    console.log(
      `Using ${seedTracks.length} seed tracks for recommendations...`
    );

    // Get recommendations using our ML model
    const recommendations = recommender.getRecommendations(seedTracks, 10);
    console.log("Got recommendations:", recommendations);

    // Get full track objects for recommended tracks
    const recommendedTracks = await Promise.all(
      recommendations.map(async (rec) => {
        const response = await axios.get(
          `https://api.spotify.com/v1/tracks/${rec.trackId}`,
          {
            headers: { Authorization: `Bearer ${access_token}` },
          }
        );
        return {
          ...response.data,
          similarity_score: rec.score,
        };
      })
    );

    // Create a new playlist
    const playlist = await axios.post(
      `https://api.spotify.com/v1/users/${user_id}/playlists`,
      {
        name: "RecomML - Smart Recommendations",
        description:
          "Personalized recommendations using content-based filtering",
        public: true,
      },
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    // Add recommended tracks to the playlist
    await axios.post(
      `https://api.spotify.com/v1/playlists/${playlist.data.id}/tracks`,
      {
        uris: recommendedTracks.map((track) => track.uri),
      },
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    res.send(`
      <h2>Playlist Created Successfully!</h2>
      <h3>Seed Tracks:</h3>
      <ul>
        ${seedTracks
          .map((track) => `<li>${track.name} by ${track.artists[0].name}</li>`)
          .join("")}
      </ul>
      <h3>Recommended Tracks (with similarity scores):</h3>
      <ul>
        ${recommendedTracks
          .map(
            (track) =>
              `<li>${track.name} by ${track.artists[0].name} (Similarity: ${(
                track.similarity_score * 100
              ).toFixed(1)}%)</li>`
          )
          .join("")}
      </ul>
      <p><a href="https://open.spotify.com/playlist/${
        playlist.data.id
      }" target="_blank">View Playlist on Spotify</a></p>
    `);
  } catch (err) {
    console.error("Error creating playlist:", err.response?.data || err);
    res.send("Error creating playlist. Please try again.");
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
});
