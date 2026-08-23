import { google } from "googleapis";

// Helper to determine if credentials are in JSON format or a file path
const getAuthOptions = () => {
    const creds = "quiz-dev-d120e-1b0837683ede.json";
    if (!creds) {
        throw new Error("GOOGLE_CALENDAR_CREDENTIALS is not defined in .env");
    }

    try {
        // Try to parse if it's a JSON string
        const credentials = JSON.parse(creds);
        return { credentials, scopes: ["https://www.googleapis.com/auth/calendar"] };
    } catch (e) {
        // Otherwise treat it as a file path
        return { keyFile: creds, scopes: ["https://www.googleapis.com/auth/calendar"] };
    }
};

const auth = new google.auth.GoogleAuth(getAuthOptions());

export const calendar = google.calendar({
    version: "v3",
    auth,
});



// Initialize the client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Now you can use oauth2Client to generate auth URLs or create meetings!
export default oauth2Client;
