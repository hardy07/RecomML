import React, { useState, useEffect } from "react";
import {
  MusicalNoteIcon,
  PlayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/solid";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isModelTrained, setIsModelTrained] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playlistDetails, setPlaylistDetails] = useState({
    name: "RecomML - Smart Recommendations",
    description: "Personalized recommendations using content-based filtering",
  });
  const [showPlaylistForm, setShowPlaylistForm] = useState(false);

  useEffect(() => {
    // Check URL parameters for login status
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("status") === "success") {
      setIsLoggedIn(true);
      // Clean up the URL
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  const handleLogin = () => {
    window.location.href = "/login";
  };

  const handleTrainModel = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/train-model");
      const data = await response.json();

      if (response.ok) {
        setIsModelTrained(true);
      } else {
        setError(data.error || "Failed to train model");
      }
    } catch (error) {
      console.error("Error training model:", error);
      setError("Failed to train model");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/create-playlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(playlistDetails),
      });
      const data = await response.json();

      if (response.ok) {
        setRecommendations(data);
        setShowPlaylistForm(false);
        // Open the playlist in a new tab
        if (data.playlist_url) {
          window.open(data.playlist_url, "_blank");
        }
      } else {
        setError(data.error || "Failed to create playlist");
      }
    } catch (error) {
      console.error("Error creating playlist:", error);
      setError("Failed to create playlist");
    } finally {
      setLoading(false);
    }
  };

  const handlePlaylistDetailsChange = (e) => {
    const { name, value } = e.target;
    setPlaylistDetails((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleHomeClick = () => {
    // Reset the application state
    setRecommendations(null);
    setShowPlaylistForm(false);
    setError(null);
    // Redirect to home page
    window.location.href = "/";
  };

  const renderProgressSteps = () => (
    <div className="mb-8">
      <div className="flex items-center justify-center space-x-4">
        <div
          className={`flex items-center ${
            isLoggedIn ? "text-spotify-green" : "text-gray-400"
          }`}
        >
          <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center">
            {isLoggedIn ? <CheckCircleIcon className="w-6 h-6" /> : "1"}
          </div>
          <span className="ml-2">Connect</span>
        </div>
        <ChevronRightIcon className="w-4 h-4 text-gray-400" />
        <div
          className={`flex items-center ${
            isModelTrained
              ? "text-spotify-green"
              : isLoggedIn
              ? "text-white"
              : "text-gray-400"
          }`}
        >
          <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center">
            {isModelTrained ? <CheckCircleIcon className="w-6 h-6" /> : "2"}
          </div>
          <span className="ml-2">Train</span>
        </div>
        <ChevronRightIcon className="w-4 h-4 text-gray-400" />
        <div
          className={`flex items-center ${
            recommendations
              ? "text-spotify-green"
              : isModelTrained
              ? "text-white"
              : "text-gray-400"
          }`}
        >
          <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center">
            {recommendations ? <CheckCircleIcon className="w-6 h-6" /> : "3"}
          </div>
          <span className="ml-2">Generate</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-spotify-black text-spotify-white flex flex-col">
      <nav className="bg-spotify-gray p-4">
        <div className="container mx-auto flex items-center">
          <button
            onClick={handleHomeClick}
            className="flex items-center hover:opacity-80 transition-opacity focus:outline-none"
          >
            <MusicalNoteIcon className="h-8 w-8 text-spotify-green mr-2" />
            <h1 className="text-2xl font-bold">RecomML</h1>
          </button>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 flex-grow">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold mb-4">
              Smart Music Recommendations
            </h2>
            <p className="text-lg text-gray-400">
              Get personalized music recommendations powered by machine learning
            </p>
          </div>

          {renderProgressSteps()}

          {error && (
            <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-500 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {!isLoggedIn ? (
              <div className="bg-spotify-gray rounded-lg p-6">
                <h3 className="text-xl font-bold mb-4">
                  Step 1: Connect with Spotify
                </h3>
                <p className="text-gray-400 mb-4">
                  Connect your Spotify account to get started with personalized
                  recommendations.
                </p>
                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full bg-spotify-green hover:bg-opacity-80 text-white font-bold py-4 px-6 rounded-full flex items-center justify-center disabled:opacity-50"
                >
                  <PlayIcon className="h-6 w-6 mr-2" />
                  Connect with Spotify
                </button>
              </div>
            ) : !isModelTrained ? (
              <div className="bg-spotify-gray rounded-lg p-6">
                <h3 className="text-xl font-bold mb-4">
                  Step 2: Train Recommendation Model
                </h3>
                <p className="text-gray-400 mb-4">
                  Train the model using your music preferences to get accurate
                  recommendations.
                </p>
                <button
                  onClick={handleTrainModel}
                  disabled={loading}
                  className="w-full bg-spotify-green hover:bg-opacity-80 text-white font-bold py-4 px-6 rounded-full flex items-center justify-center disabled:opacity-50"
                >
                  {loading ? (
                    <ArrowPathIcon className="h-6 w-6 mr-2 animate-spin" />
                  ) : (
                    <ArrowPathIcon className="h-6 w-6 mr-2" />
                  )}
                  {loading ? "Training Model..." : "Train Recommendation Model"}
                </button>
              </div>
            ) : showPlaylistForm ? (
              <div className="bg-spotify-gray rounded-lg p-6">
                <h3 className="text-xl font-bold mb-4">
                  Step 3: Customize Your Playlist
                </h3>
                <p className="text-gray-400 mb-4">
                  Customize your playlist details before generation.
                </p>
                <form onSubmit={handleCreatePlaylist} className="space-y-4">
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium mb-2"
                    >
                      Playlist Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={playlistDetails.name}
                      onChange={handlePlaylistDetailsChange}
                      className="w-full px-4 py-2 rounded-md bg-black border border-gray-600 text-white focus:outline-none focus:border-spotify-green"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="description"
                      className="block text-sm font-medium mb-2"
                    >
                      Description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={playlistDetails.description}
                      onChange={handlePlaylistDetailsChange}
                      rows="3"
                      className="w-full px-4 py-2 rounded-md bg-black border border-gray-600 text-white focus:outline-none focus:border-spotify-green"
                      required
                    />
                  </div>
                  <div className="flex space-x-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-spotify-green hover:bg-opacity-80 text-white font-bold py-4 px-6 rounded-full flex items-center justify-center disabled:opacity-50"
                    >
                      {loading ? (
                        <ArrowPathIcon className="h-6 w-6 mr-2 animate-spin" />
                      ) : (
                        <MusicalNoteIcon className="h-6 w-6 mr-2" />
                      )}
                      {loading ? "Creating Playlist..." : "Create Playlist"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPlaylistForm(false)}
                      className="px-6 py-4 rounded-full border border-gray-600 hover:border-gray-400 text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-spotify-gray rounded-lg p-6">
                <h3 className="text-xl font-bold mb-4">
                  Step 3: Generate Playlist
                </h3>
                <p className="text-gray-400 mb-4">
                  Create a personalized playlist based on your music taste.
                </p>
                <button
                  onClick={() => setShowPlaylistForm(true)}
                  className="w-full bg-spotify-green hover:bg-opacity-80 text-white font-bold py-4 px-6 rounded-full flex items-center justify-center"
                >
                  <MusicalNoteIcon className="h-6 w-6 mr-2" />
                  Generate Playlist
                </button>
              </div>
            )}
          </div>

          {recommendations && (
            <div className="mt-12 bg-spotify-gray rounded-lg p-6">
              <h3 className="text-2xl font-bold mb-6">Your Recommendations</h3>
              <div className="space-y-4">
                {recommendations.tracks.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center p-4 bg-black bg-opacity-50 rounded-lg hover:bg-opacity-75 transition-all"
                  >
                    <img
                      src={track.album.images[2].url}
                      alt={track.name}
                      className="w-12 h-12 rounded mr-4"
                    />
                    <div className="flex-grow">
                      <h4 className="font-semibold">{track.name}</h4>
                      <p className="text-gray-400">{track.artists[0].name}</p>
                    </div>
                    <div className="ml-4">
                      <span className="text-spotify-green">
                        {Math.round(track.similarity_score * 100)}% match
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 text-center">
                <a
                  href={recommendations.playlist_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-spotify-green hover:underline"
                >
                  Open Playlist in Spotify
                </a>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-spotify-gray py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-gray-400">
          <p>Powered by RecomML - Smart Music Recommendations</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
