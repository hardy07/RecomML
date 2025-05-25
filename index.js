const express = require("express");
const axios = require("axios");
const querystring = require("querystring");
const path = require("path");
const MusicRecommender = require("./model");
require("dotenv").config();

const app = express();
const PORT = 3000;

let access_token = "";
let refresh_token = "";
const recommender = new MusicRecommender();
let isModelTrained = false;

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, "dist")));

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

    // Redirect back to the frontend with success status
    res.redirect("/?status=success");
  } catch (err) {
    console.error(err.response?.data || err);
    res.redirect("/?status=error");
  }
});

app.get("/train-model", async (req, res) => {
  try {
    if (!access_token) {
      return res.status(401).json({ error: "Not authenticated" });
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

    res.json({
      success: true,
      message: "Model trained successfully",
      tracksCount: uniqueTracks.length,
    });
  } catch (err) {
    console.error("Error training model:", err.response?.data || err);
    res.status(500).json({ error: "Error training model" });
  }
});

app.get("/create-playlist", async (req, res) => {
  try {
    if (!access_token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!isModelTrained) {
      return res.status(400).json({ error: "Model not trained" });
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

    res.json({
      success: true,
      playlist_url: `https://open.spotify.com/playlist/${playlist.data.id}`,
      tracks: recommendedTracks,
      seed_tracks: seedTracks,
    });
  } catch (err) {
    console.error("Error creating playlist:", err.response?.data || err);
    res.status(500).json({ error: "Error creating playlist" });
  }
});

// Catch-all route to serve the frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
});
