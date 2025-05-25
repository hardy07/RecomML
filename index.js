const express = require("express");
const axios = require("axios");
const querystring = require("querystring");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const connectDB = require("./config/database");
const User = require("./models/User");
const MusicRecommender = require("./model");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Middleware to parse JSON bodies
app.use(express.json());

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 24 * 60 * 60, // Session TTL of 1 day
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, "dist")));

const recommender = new MusicRecommender();
let isModelTrained = false;

// Add a function to refresh the access token
async function refreshAccessToken(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const { refreshToken } = user.getDecryptedTokens();

    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      querystring.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
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

    // Update user tokens
    user.accessToken = response.data.access_token;
    if (response.data.refresh_token) {
      user.refreshToken = response.data.refresh_token;
    }
    user.tokenExpires = new Date(Date.now() + response.data.expires_in * 1000);
    await user.save();

    return user.getDecryptedTokens().accessToken;
  } catch (error) {
    console.error("Error refreshing token:", error.response?.data || error);
    throw error;
  }
}

// Middleware to check authentication
const requireAuth = async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Check if token needs refresh
    if (user.tokenExpires <= new Date()) {
      const newAccessToken = await refreshAccessToken(user._id);
      req.accessToken = newAccessToken;
    } else {
      req.accessToken = user.getDecryptedTokens().accessToken;
    }

    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
};

app.get("/login", (req, res) => {
  // Log environment variables (safely)
  console.log("Login route - Environment check:", {
    hasClientId: !!process.env.CLIENT_ID,
    hasClientSecret: !!process.env.CLIENT_SECRET,
    redirectUri: process.env.REDIRECT_URI,
  });

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

  console.log(
    "Redirecting to Spotify auth URL (client_id and redirect_uri present)"
  );
  res.redirect(authURL);
});

app.get("/callback", async (req, res) => {
  const code = req.query.code || null;

  try {
    // Log the incoming request
    console.log("Callback received with code:", code ? "Present" : "Missing");

    const tokenResponse = await axios
      .post(
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
      )
      .catch((error) => {
        console.error("Token exchange error:", {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        throw error;
      });

    console.log("Token exchange successful");

    // Get user profile from Spotify
    const userProfile = await axios
      .get("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` },
      })
      .catch((error) => {
        console.error("Profile fetch error:", {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        throw error;
      });

    console.log("User profile fetched successfully");

    // Find or create user
    let user = await User.findOne({ spotifyId: userProfile.data.id });
    if (!user) {
      console.log("Creating new user");
      user = new User({
        spotifyId: userProfile.data.id,
        email: userProfile.data.email,
      });
    } else {
      console.log("Found existing user");
    }

    // Update user tokens
    user.accessToken = tokenResponse.data.access_token;
    user.refreshToken = tokenResponse.data.refresh_token;
    user.tokenExpires = new Date(
      Date.now() + tokenResponse.data.expires_in * 1000
    );
    user.lastLogin = new Date();

    await user.save().catch((error) => {
      console.error("User save error:", {
        message: error.message,
        code: error.code,
        name: error.name,
      });
      throw error;
    });

    console.log("User saved successfully");

    // Set user session
    req.session.userId = user._id;

    res.redirect("/?status=success");
  } catch (err) {
    console.error("Callback error:", {
      message: err.message,
      response: err.response?.data,
      stack: err.stack,
    });
    res.redirect("/?status=error&reason=" + encodeURIComponent(err.message));
  }
});

app.get("/train-model", requireAuth, async (req, res) => {
  try {
    // Get user's saved tracks and recently played tracks for training
    const [savedTracks, recentTracks] = await Promise.all([
      axios.get("https://api.spotify.com/v1/me/tracks?limit=50", {
        headers: { Authorization: `Bearer ${req.accessToken}` },
      }),
      axios.get(
        "https://api.spotify.com/v1/me/player/recently-played?limit=50",
        {
          headers: { Authorization: `Bearer ${req.accessToken}` },
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

app.post("/create-playlist", requireAuth, async (req, res) => {
  try {
    if (!isModelTrained) {
      return res.status(400).json({ error: "Model not trained" });
    }

    // Get playlist details from request body
    const playlistName = req.body.name || "RecomML - Smart Recommendations";
    const playlistDescription =
      req.body.description ||
      "Personalized recommendations using content-based filtering";

    // Get user profile
    const userProfile = await axios.get("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${req.accessToken}` },
    });
    const user_id = userProfile.data.id;

    // Get recently played tracks as seed
    const recentTracks = await axios.get(
      "https://api.spotify.com/v1/me/player/recently-played?limit=10",
      {
        headers: { Authorization: `Bearer ${req.accessToken}` },
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
            headers: { Authorization: `Bearer ${req.accessToken}` },
          }
        );
        return {
          ...response.data,
          similarity_score: rec.score,
        };
      })
    );

    // Create a new playlist with custom name and description
    const playlist = await axios.post(
      `https://api.spotify.com/v1/users/${user_id}/playlists`,
      {
        name: playlistName,
        description: playlistDescription,
        public: true,
      },
      {
        headers: { Authorization: `Bearer ${req.accessToken}` },
      }
    );

    // Add recommended tracks to the playlist
    await axios.post(
      `https://api.spotify.com/v1/playlists/${playlist.data.id}/tracks`,
      {
        uris: recommendedTracks.map((track) => track.uri),
      },
      {
        headers: { Authorization: `Bearer ${req.accessToken}` },
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

// Add check-auth endpoint
app.get("/check-auth", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.json({ isAuthenticated: false });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.json({ isAuthenticated: false });
    }

    // Check if token needs refresh
    if (user.tokenExpires <= new Date()) {
      try {
        await refreshAccessToken(user._id);
      } catch (error) {
        console.error("Error refreshing token:", error);
        return res.json({ isAuthenticated: false });
      }
    }

    res.json({ isAuthenticated: true });
  } catch (error) {
    console.error("Error checking auth:", error);
    res.json({ isAuthenticated: false });
  }
});

// Catch-all route to serve the frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
});
