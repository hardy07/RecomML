const natural = require("natural");
const stringSimilarity = require("string-similarity");
const tokenizer = new natural.WordTokenizer();
const TfIdf = natural.TfIdf;

class MusicRecommender {
  constructor() {
    this.tracks = new Map();
    this.tfidf = new TfIdf();
    this.documentMap = new Map();
  }

  preprocessText(text) {
    return tokenizer.tokenize((text || "").toLowerCase());
  }

  // Extract features from track metadata
  extractFeatures(track) {
    if (!track) {
      console.error("Received undefined track");
      return null;
    }

    if (!track.name || !track.artists || !track.artists[0]) {
      console.error("Track missing required properties:", {
        hasName: !!track.name,
        hasArtists: !!track.artists,
        hasFirstArtist: track.artists && track.artists[0],
      });
      return null;
    }

    const nameTokens = this.preprocessText(track.name);
    const artistTokens = this.preprocessText(track.artists[0].name);

    // Combine all features
    return {
      id: track.id,
      name: track.name,
      artist: track.artists[0].name,
      popularity: track.popularity || 0,
      tokens: [...new Set([...nameTokens, ...artistTokens])],
      genres: track.artists[0].genres || [],
    };
  }

  // Train the model on user's listening history
  train(tracks) {
    console.log("Processing tracks for training...");

    if (!Array.isArray(tracks)) {
      console.error("Expected tracks to be an array, got:", typeof tracks);
      throw new Error("Invalid tracks data");
    }

    // Store tracks and create TF-IDF documents
    tracks.forEach((track, index) => {
      const features = this.extractFeatures(track);
      if (!features) {
        console.warn(`Skipping invalid track at index ${index}`);
        return;
      }

      this.tracks.set(track.id, features);

      // Create document for TF-IDF
      const document = [...features.tokens, ...features.genres].join(" ");
      this.tfidf.addDocument(document);
      this.documentMap.set(index, track.id);
    });

    console.log(
      `Processed ${this.tracks.size} valid tracks out of ${tracks.length} total`
    );
  }

  calculateSimilarity(track1, track2) {
    // Calculate name similarity
    const nameSimilarity = stringSimilarity.compareTwoStrings(
      track1.name.toLowerCase(),
      track2.name.toLowerCase()
    );

    // Calculate artist similarity
    const artistSimilarity = stringSimilarity.compareTwoStrings(
      track1.artist.toLowerCase(),
      track2.artist.toLowerCase()
    );

    // Calculate token similarity
    const tokenSimilarity = stringSimilarity.compareTwoStrings(
      track1.tokens.join(" "),
      track2.tokens.join(" ")
    );

    // Calculate popularity similarity (normalized difference)
    const popSimilarity =
      1 - Math.abs(track1.popularity - track2.popularity) / 100;

    // Weighted average of similarities
    return (
      nameSimilarity * 0.3 +
      artistSimilarity * 0.3 +
      tokenSimilarity * 0.2 +
      popSimilarity * 0.2
    );
  }

  // Get recommendations based on seed tracks
  getRecommendations(seedTracks, numRecommendations = 10) {
    if (!seedTracks || !Array.isArray(seedTracks)) {
      console.error("Invalid seed tracks:", seedTracks);
      throw new Error("Invalid seed tracks data");
    }

    if (this.tracks.size === 0) {
      console.error("No tracks available for recommendations");
      throw new Error("No tracks available for recommendations");
    }

    console.log(
      `Finding recommendations using ${seedTracks.length} seed tracks...`
    );

    // Get features for seed tracks
    const seedFeatures = seedTracks
      .map((track) => {
        if (!track || !track.id) {
          console.warn("Invalid seed track:", track);
          return null;
        }
        const features = this.tracks.get(track.id);
        if (!features) {
          console.warn(`No features found for seed track ${track.id}`);
        }
        return features;
      })
      .filter((f) => f !== undefined && f !== null);

    if (seedFeatures.length === 0) {
      console.error("No valid seed tracks found after filtering");
      throw new Error("No valid seed tracks found");
    }

    console.log(
      `Using ${seedFeatures.length} valid seed tracks for recommendations`
    );

    // Create a Set of all recently played track IDs for faster lookup
    const recentTrackIds = new Set(
      seedTracks.filter((t) => t && t.id).map((track) => track.id)
    );

    // Calculate similarity scores for all tracks
    const scores = new Map();
    let processedTracks = 0;

    this.tracks.forEach((candidateTrack, trackId) => {
      // Skip if the track is in recently played
      if (recentTrackIds.has(trackId)) {
        return;
      }

      try {
        // Calculate average similarity with all seed tracks
        const avgSimilarity =
          seedFeatures.reduce((sum, seedTrack) => {
            return sum + this.calculateSimilarity(seedTrack, candidateTrack);
          }, 0) / seedFeatures.length;

        scores.set(trackId, avgSimilarity);
        processedTracks++;
      } catch (error) {
        console.warn(`Error processing track ${trackId}:`, error.message);
      }
    });

    console.log(`Processed ${processedTracks} tracks for recommendations`);

    if (scores.size === 0) {
      throw new Error("Could not generate any recommendations");
    }

    // Sort tracks by similarity and return top N
    const recommendations = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, numRecommendations)
      .map(([trackId, score]) => ({
        trackId,
        score,
      }));

    console.log(`Found ${recommendations.length} recommendations`);
    return recommendations;
  }
}

module.exports = MusicRecommender;
