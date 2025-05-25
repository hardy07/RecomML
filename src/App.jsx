import React, { useState, useEffect } from "react";
import {
  MusicalNoteIcon,
  PlayIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/solid";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isModelTrained, setIsModelTrained] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const handleCreatePlaylist = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/create-playlist");
      const data = await response.json();

      if (response.ok) {
        setRecommendations(data);
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

  return (
    <div className="min-h-screen bg-spotify-black text-spotify-white">
      <nav className="bg-spotify-gray p-4">
        <div className="container mx-auto flex items-center">
          <MusicalNoteIcon className="h-8 w-8 text-spotify-green mr-2" />
          <h1 className="text-2xl font-bold">RecomML</h1>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">
              Smart Music Recommendations
            </h2>
            <p className="text-lg text-gray-400">
              Get personalized music recommendations powered by machine learning
            </p>
          </div>

          {error && (
            <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-500 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {!isLoggedIn ? (
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-spotify-green hover:bg-opacity-80 text-white font-bold py-4 px-6 rounded-full flex items-center justify-center disabled:opacity-50"
              >
                <PlayIcon className="h-6 w-6 mr-2" />
                Connect with Spotify
              </button>
            ) : !isModelTrained ? (
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
            ) : (
              <button
                onClick={handleCreatePlaylist}
                disabled={loading}
                className="w-full bg-spotify-green hover:bg-opacity-80 text-white font-bold py-4 px-6 rounded-full flex items-center justify-center disabled:opacity-50"
              >
                {loading ? (
                  <ArrowPathIcon className="h-6 w-6 mr-2 animate-spin" />
                ) : (
                  <MusicalNoteIcon className="h-6 w-6 mr-2" />
                )}
                {loading ? "Creating Playlist..." : "Generate Playlist"}
              </button>
            )}
          </div>

          {recommendations && (
            <div className="mt-12 bg-spotify-gray rounded-lg p-6">
              <h3 className="text-2xl font-bold mb-6">Your Recommendations</h3>
              <div className="space-y-4">
                {recommendations.tracks.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center p-4 bg-opacity-50 bg-black rounded-lg hover:bg-opacity-75 transition-all"
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

      <footer className="bg-spotify-gray mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-gray-400">
          <p>Powered by RecomML - Smart Music Recommendations</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
