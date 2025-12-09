let API_URL = "";

const origin = window.location.origin;

// If not localhost → hosted mode
if (!origin.includes("localhost")) {
    // Use subdomain to bypass Cloudflare for large uploads
    if (origin.includes("shreemata.com")) {
        API_URL = "https://api.shreemata.com";
    } else {
        API_URL = origin + "/api";
    }
}
// Local development
else {
    API_URL = "http://localhost:3000/api";
}

console.log("API_URL Loaded:", API_URL);

window.API_URL = API_URL;
