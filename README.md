# RecomML 🎵

RecomML is a personalized music recommendation web app that analyzes your Spotify listening habits using machine learning to suggest similar tracks and automatically creates a custom playlist saved to your Spotify account.

![RecomML Screenshot](./public/screenshot.png)

## Features ✨

- **Spotify Integration**: Seamlessly connects with your Spotify account
- **Machine Learning Analysis**: Analyzes your music preferences using content-based filtering
- **Personalized Recommendations**: Generates music suggestions based on your unique taste
- **Automatic Playlist Creation**: Creates and saves custom playlists directly to your Spotify account
- **Modern UI/UX**: Clean, responsive interface with Spotify-inspired design
- **Progress Tracking**: Clear 3-step process with visual feedback

## How It Works 🔍

1. **Connect**: Link your Spotify account to grant RecomML access to your listening history
2. **Train**: Our machine learning model analyzes your music preferences
3. **Generate**: Get personalized track recommendations and a custom playlist

## Tech Stack 🛠️

- **Frontend**: React + Vite
- **Styling**: Tailwind CSS
- **Authentication**: Spotify OAuth
- **Database**: MongoDB
- **Machine Learning**: Content-based filtering algorithm
- **API**: Node.js/Express backend

## Getting Started 🚀

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Spotify Developer Account

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/RecomML.git
cd RecomML
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory:

```env
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
VITE_SPOTIFY_REDIRECT_URI=http://localhost:5173
MONGODB_URI=your_mongodb_uri
```

4. Start the development server:

```bash
npm run dev
```

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


## Acknowledgments 🙏

- Spotify Web API
- React Community
- TailwindCSS Team

## Contact 📧

Your Name - [@yourusername](https://twitter.com/yourusername)

Project Link: [https://github.com/hardy07/RecomML](https://github.com/hardy07/RecomML)

---

Made with ❤️ using Machine Learning and Spotify
