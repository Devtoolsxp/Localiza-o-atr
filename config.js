// config.js
export const firebaseConfig = {
    apiKey: "AIzaSyAWhfaY2Adp4YJGwvITWTGHP-7zOLNfiGI",
    authDomain: "sandalias-retro-9f0c6.firebaseapp.com",
    databaseURL: "https://sandalias-retro-9f0c6-default-rtdb.firebaseio.com",
    projectId: "sandalias-retro-9f0c6",
    storageBucket: "sandalias-retro-9f0c6.appspot.com",
    messagingSenderId: "786208752798",
    appId: "1:786208752798:web:193f76bbbf5ac4ef27678f",
    measurementId: "G-XGVHLX01EB"
};

export const cloudinaryPreset = "testes";
export const cloudinaryUploadURL = "https://api.cloudinary.com/v1_1/dwwfxq3rm/video/upload";
export const ipAPI = "https://api.ipify.org?format=json";
export const geolocationAPI = (lat, lon) =>
  `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
