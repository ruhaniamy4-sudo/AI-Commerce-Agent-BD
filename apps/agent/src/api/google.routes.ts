import { Router } from 'express';
import { google } from 'googleapis';
import { Customer } from '../models/Customer';
import { Meeting } from '../models/Meeting';
import oauth2Client from '../utils/googleCalendar';

const router = Router();

// This route starts the login process
router.get('/auth', (_, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Critical for AI Agents to get a Refresh Token
        scope: ['https://www.googleapis.com/auth/calendar.events'],
        prompt: 'consent', // Forces Google to provide a Refresh Token every time for testing
    });
    res.redirect(url);
});

// THIS IS YOUR REDIRECT URI ROUTE
router.get('/callback', async (req, res) => {
    const { code } = req.query; // Google sends the 'code' here

    try {
        if (!code) {
            return res.status(400).send('No authorization code provided.');
        }

        // Exchange the code for actual tokens (Access Token & Refresh Token)
        const { tokens } = await oauth2Client.getToken(code as string);
        oauth2Client.setCredentials(tokens);

        // TODO: SAVE THESE TOKENS TO YOUR DATABASE
        // Especially the tokens.refresh_token for your AI Agent
        // This is important for long-term use without re-authentication

        console.log('Tokens acquired successfully!');
        console.log(
            'Refresh token:',
            tokens.refresh_token ? '✓ Present' : '✗ Missing'
        );

        res.send(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #34a853;">✅ Authentication Successful!</h1>
            <p>You can now close this tab.</p>
            <p style="color: #666;">You can now use /google/schedule-meeting to create meetings with Google Meet links.</p>
          </body>
        </html>
      `);
    } catch (error: any) {
        console.error('Error exchanging code for tokens:', error);
        res.status(500).send(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #ea4335;">❌ Authentication Failed</h1>
            <p>${error.message}</p>
          </body>
        </html>
      `);
    }
});

/**
 * GET /google/auth-status
 * Check if OAuth2 authentication is active
 */
router.get('/auth-status', (_, res) => {
    const credentials = oauth2Client.credentials;
    const isAuthenticated = !!(credentials && credentials.access_token);

    res.json({
        authenticated: isAuthenticated,
        hasRefreshToken: !!(credentials && credentials.refresh_token),
        expiresAt: credentials?.expiry_date
            ? new Date(credentials.expiry_date).toISOString()
            : null,
        message: isAuthenticated
            ? 'OAuth2 authentication is active. You can create meetings.'
            : 'Please authenticate by visiting /google/auth',
    });
});

/**
 * Function for AI Agent to book a client meeting with Google Meet link
 * @param clientEmail - Email of the client to invite
 * @param startTime - ISO 8601 date string for start time
 * @param endTime - ISO 8601 date string for end time
 * @param title - Optional title for the meeting (defaults to "Discovery Call with AI Agent")
 * @param description - Optional description for the meeting
 * @returns Meeting details including Google Meet link
 */
async function scheduleClientMeeting(
    clientEmail: string,
    startTime: string,
    endTime: string,
    title?: string,
    description?: string
) {
    // Check if OAuth2 client has credentials
    const credentials = oauth2Client.credentials;
    if (!credentials || !credentials.access_token) {
        throw new Error(
            'OAuth2 authentication required. Please authenticate first by visiting /google/auth'
        );
    }

    // Create calendar instance using OAuth2 client (not service account)
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Generate unique request ID for conference creation
    const requestId = `ai-gen-${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}`;

    const event = {
        summary: title || 'Discovery Call with AI Agent',
        description: description || `Meeting scheduled with ${clientEmail}`,
        attendees: [{ email: clientEmail }],
        start: {
            dateTime: startTime,
            timeZone: 'UTC',
        },
        end: {
            dateTime: endTime,
            timeZone: 'UTC',
        },
        conferenceData: {
            createRequest: {
                requestId: requestId,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
        },
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'email', minutes: 24 * 60 }, // 1 day before
                { method: 'popup', minutes: 15 }, // 15 minutes before
            ],
        },
    };

    try {
        // Insert event with Google Meet conference using OAuth2
        // Reference: https://googleapis.dev/nodejs/googleapis/latest/calendar/classes/Resource$Events.html#insert
        const response = await calendar.events.insert({
            calendarId: 'primary',
            conferenceDataVersion: 1, // Required to create Google Meet link
            sendUpdates: 'all', // Send email invitations to all attendees
            requestBody: event,
        });

        const eventData = response.data;

        // Extract Google Meet link from various possible locations in the response
        let meetLink = eventData.hangoutLink;
        if (!meetLink && eventData.conferenceData?.entryPoints) {
            // Try to find the video entry point
            const videoEntry = eventData.conferenceData.entryPoints.find(
                (ep: any) =>
                    ep.entryPointType === 'video' || ep.type === 'video'
            );
            meetLink =
                videoEntry?.uri || eventData.conferenceData.entryPoints[0]?.uri;
        }

        const htmlLink = eventData.htmlLink;
        const eventId = eventData.id;

        // Log for debugging
        console.log('Event created:', {
            eventId,
            hasMeetLink: !!meetLink,
            meetLink,
            conferenceData: eventData.conferenceData,
        });

        // Find or create customer in database
        let client = await Customer.findOne({ email: clientEmail });
        if (!client) {
            client = await Customer.create({
                psid: `auto-${Date.now()}`, // Temporary PSID for auto-created customers
                name: clientEmail.split('@')[0],
                email: clientEmail,
            });
        }

        // Save meeting to database
        const meeting = await Meeting.create({
            customerId: client._id.toString(),
            title: event.summary || 'Meeting',
            description: event.description || '',
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            location: meetLink || undefined,
            status: 'scheduled',
            googleCalendarEventId: eventId || undefined,
        });
        console.log(meeting);

        return {
            success: true,
            meetingId: meeting._id.toString(),
            eventId: eventId,
            title: event.summary,
            startTime: startTime,
            endTime: endTime,
            meetLink: meetLink,
            htmlLink: htmlLink, // Direct link to view event in Google Calendar
            calendarUrl: 'https://calendar.google.com/calendar', // Link to Google Calendar
            attendees: [clientEmail],
            message: `Event created! View it at: ${htmlLink}`,
        };
    } catch (error: any) {
        console.error('Error creating calendar event:', error);
        throw new Error(`Failed to create meeting: ${error.message}`);
    }
}

/**
 * POST /google/schedule-meeting
 * Schedule a meeting with Google Calendar and create a Google Meet link
 *
 * Request body:
 * {
 *   "clientEmail": "client@example.com",
 *   "startTime": "2026-04-03T10:00:00Z",
 *   "endTime": "2026-04-03T11:00:00Z",
 *   "title": "Discovery Call" (optional),
 *   "description": "Meeting description" (optional)
 * }
 */
router.get('/schedule-meeting', async (req, res) => {
    try {
        // const { clientEmail, startTime, endTime, title, description } = req.body;
        const clientEmail = 'imranbappy.official@gmail.com';
        const startTime = '2026-01-05T10:00:00Z';
        const endTime = '2026-04-05T11:00:00Z';
        const title = 'Discovery Call with AI Agent';
        const description = 'Meeting description';

        // Validate required fields
        if (!clientEmail || !startTime || !endTime) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['clientEmail', 'startTime', 'endTime'],
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(clientEmail)) {
            return res.status(400).json({
                error: 'Invalid email format',
            });
        }

        // Validate date format (ISO 8601)
        const startDate = new Date(startTime);
        const endDate = new Date(endTime);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({
                error: 'Invalid date format. Use ISO 8601 format (e.g., 2026-04-03T10:00:00Z)',
            });
        }

        // Validate end time is after start time
        if (endDate <= startDate) {
            return res.status(400).json({
                error: 'End time must be after start time',
            });
        }

        const result = await scheduleClientMeeting(
            clientEmail,
            startTime,
            endTime,
            title,
            description
        );

        res.json(result);
    } catch (error: any) {
        console.error('Error in schedule-meeting endpoint:', error);
        res.status(500).json({
            error: 'Failed to schedule meeting',
            message: error.message,
        });
    }
});

/**
 * GET /google/list-events
 * List upcoming events from Google Calendar
 * Query params:
 * - maxResults: number (default: 10)
 * - timeMin: ISO date string (optional, defaults to now)
 */
router.get('/list-events', async (req, res) => {
    try {
        // Check if OAuth2 client has credentials
        const credentials = oauth2Client.credentials;
        if (!credentials || !credentials.access_token) {
            return res.status(401).json({
                error: 'OAuth2 authentication required',
                message: 'Please authenticate first by visiting /google/auth',
            });
        }

        // Create calendar instance using OAuth2 client
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const maxResults = parseInt(req.query.maxResults as string) || 10;
        const timeMin =
            (req.query.timeMin as string) || new Date().toISOString();

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMin,
            maxResults: maxResults,
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = (response.data.items || []).map((event) => ({
            id: event.id,
            title: event.summary,
            description: event.description,
            startTime: event.start?.dateTime || event.start?.date,
            endTime: event.end?.dateTime || event.end?.date,
            location: event.location,
            meetLink: event.hangoutLink,
            htmlLink: event.htmlLink,
            attendees: event.attendees?.map((a) => a.email) || [],
            status: event.status,
        }));

        res.json({
            success: true,
            calendarId: 'primary',
            calendarUrl: 'https://calendar.google.com/calendar',
            totalEvents: events.length,
            events: events,
        });
    } catch (error: any) {
        console.error('Error listing calendar events:', error);
        res.status(500).json({
            error: 'Failed to list events',
            message: error.message,
        });
    }
});

export default router;
