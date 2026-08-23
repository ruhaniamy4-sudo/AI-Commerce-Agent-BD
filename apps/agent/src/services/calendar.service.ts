import { Customer } from '../models/Customer';
import { Meeting, IMeeting } from '../models/Meeting';
import { SystemConfig } from '../models/SystemConfig';
import { sendEmail } from './notification.service';

const AVAILABILITY_KEY = 'availability_settings';
const MEETING_HOSTS_KEY = 'meeting_hosts';
const DEFAULT_AVAILABILITY = {
    officeHours: { start: '09:00', end: '17:00' },
    breaks: [{ start: '13:00', end: '14:00' }],
    workingDays: [0, 1, 2, 3, 4], // Sunday to Thursday
    meetingBuffer: 10, // minutes
};

async function getAvailabilitySettings() {
    const config = await SystemConfig.findOne({ key: AVAILABILITY_KEY });
    return config?.value || DEFAULT_AVAILABILITY;
}

async function getMeetingHosts() {
    const config = await SystemConfig.findOne({ key: MEETING_HOSTS_KEY });
    return config?.value || [{ email: 'admin@edutechs.org', name: 'Admin' }];
}

function generateMeetingEmailHtml(data: {
    clientEmail: string;
    title: string;
    startTime: string;
    timezone: string;
    description: string;
}) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Meeting Scheduled</title>
    <style>
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1e293b;
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            padding: 0 20px;
        }
        .card {
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
        }
        .header {
            background-color: #0f172a;
            padding: 32px 40px;
            text-align: center;
        }
        .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.025em;
        }
        .content {
            padding: 40px;
        }
        .meeting-badge {
            display: inline-block;
            background-color: #dbeafe;
            color: #1e40af;
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 20px;
        }
        .meeting-title {
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 24px;
            line-height: 1.4;
        }
        .detail-row {
            display: flex;
            margin-bottom: 16px;
            padding-bottom: 16px;
            border-bottom: 1px solid #f1f5f9;
        }
        .detail-label {
            width: 100px;
            font-weight: 600;
            color: #64748b;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .detail-value {
            flex: 1;
            color: #334155;
            font-size: 15px;
        }
        .footer {
            text-align: center;
            padding: 32px 40px;
            color: #94a3b8;
            font-size: 13px;
        }
        @media only screen and (max-width: 480px) {
            .content { padding: 30px 24px; }
            .header { padding: 24px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <h1>Edutechs AI</h1>
            </div>
            <div class="content">
                <div class="meeting-badge">New Meeting Scheduled</div>
                <div class="meeting-title">${data.title}</div>

                <div class="detail-row">
                    <div class="detail-label">Client</div>
                    <div class="detail-value">${data.clientEmail}</div>
                </div>

                <div class="detail-row">
                    <div class="detail-label">Time</div>
                    <div class="detail-value">
                        <strong>${data.startTime}</strong><br>
                        <span style="color: #64748b; font-size: 13px;">Timezone: ${data.timezone}</span>
                    </div>
                </div>

                <div class="detail-row" style="border: none;">
                    <div class="detail-label">About</div>
                    <div class="detail-value">${data.description}</div>
                </div>
            </div>
        </div>
        <div class="footer">
            &copy; ${new Date().getFullYear()} Edutechs AI Platform. All rights reserved.<br>
            Managed by Edutechs Sales Operations
        </div>
    </div>
</body>
</html>
    `;
}

export async function scheduleMeeting(data: {
    email: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    timezone: string;
    summary?: string;
    description?: string;
}) {
    const offset = data.timezone === 'Asia/Dhaka' ? '+06:00' : 'Z';
    const start = new Date(`${data.date}T${data.time}:00${offset}`);
    const durationMinutes = 30; // Default 30 mins
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    const settings = await getAvailabilitySettings();
    // Use the date string to determine day of week to avoid TZ shifts
    const dayOfWeek = new Date(`${data.date}T12:00:00Z`).getUTCDay();

    // 1. Check Working Days
    if (!settings.workingDays.includes(dayOfWeek)) {
        return {
            success: false,
            message: '❌ This day is not a working day.',
        };
    }

    // 2. Check Office Hours
    const timeToMinutes = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    const startMinutes = start.getUTCHours() * 60 + start.getUTCMinutes();
    const endMinutes = end.getUTCHours() * 60 + end.getUTCMinutes();

    // Adjust for Dhaka offset if needed
    let adjStartMinutes = startMinutes;
    let adjEndMinutes = endMinutes;
    if (data.timezone === 'Asia/Dhaka') {
        adjStartMinutes = start.getHours() * 60 + start.getMinutes();
        adjEndMinutes = end.getHours() * 60 + end.getMinutes();
    }

    const officeStart = timeToMinutes(settings.officeHours.start);
    const officeEnd = timeToMinutes(settings.officeHours.end);

    if (adjStartMinutes < officeStart || adjEndMinutes > officeEnd) {
        return {
            success: false,
            message: `❌ Meeting must be within office hours (${settings.officeHours.start} - ${settings.officeHours.end}).`,
        };
    }

    // 3. Check Breaks
    for (const b of settings.breaks) {
        const breakStart = timeToMinutes(b.start);
        const breakEnd = timeToMinutes(b.end);
        if (
            (adjStartMinutes >= breakStart && adjStartMinutes < breakEnd) ||
            (adjEndMinutes > breakStart && adjEndMinutes <= breakEnd) ||
            (adjStartMinutes <= breakStart && adjEndMinutes >= breakEnd)
        ) {
            return {
                success: false,
                message: `❌ Requested time overlaps with a break (${b.start} - ${b.end}).`,
            };
        }
    }

    // 4. Check Past Time
    const now = new Date();
    if (start < now) {
        return {
            success: false,
            message: '❌ Cannot schedule a meeting in the past.',
        };
    }

    // 5. Check Overlaps and Buffer
    const buffer = settings.meetingBuffer * 60 * 1000;
    const startWithBuffer = new Date(start.getTime() - buffer);
    const endWithBuffer = new Date(end.getTime() + buffer);

    const overlappingMeeting = await Meeting.findOne({
        status: { $ne: 'cancelled' },
        $or: [
            {
                startTime: { $lt: endWithBuffer },
                endTime: { $gt: startWithBuffer },
            },
        ],
    });

    if (overlappingMeeting) {
        return {
            success: false,
            message:
                '❌ This time slot (including buffer) overlaps with another meeting.',
        };
    }

    // Find or create customer by email
    let client = await Customer.findOne({ email: data.email });
    if (!client) {
        client = await Customer.create({
            psid: `auto-${Date.now()}`,
            name: data.email.split('@')[0], // Use email prefix as name
            email: data.email,
        });
    }

    // Save meeting to database
    const meeting = await Meeting.create({
        customerId: client._id.toString(),
        title: data.summary || 'Edutechs Client Meeting',
        description: data.description || `Meeting with ${data.email}`,
        startTime: start,
        endTime: end,
        status: 'scheduled',
    });

    // NOTIFY HOSTS
    try {
        const hosts = await getMeetingHosts();
        const hostEmails = hosts.map((h: any) => h.email);
        const subject = `📅 New Meeting Scheduled: ${meeting.title}`;
        const startTimeStr = start.toLocaleString('en-US', {
            timeZone: data.timezone,
            dateStyle: 'full',
            timeStyle: 'short'
        });

        const text = `
Hello,

A new meeting has been scheduled by a client.

Client: ${data.email}
Title: ${meeting.title}
Time: ${startTimeStr} (${data.timezone})
Description: ${meeting.description}

Regards,
Edutechs AI Platform
        `;

        const html = generateMeetingEmailHtml({
            clientEmail: data.email,
            title: meeting.title || 'Meeting Scheduled',
            startTime: startTimeStr,
            timezone: data.timezone,
            description: meeting.description || 'No description provided.'
        });

        await sendEmail(hostEmails, subject, text, html);
    } catch (notifyError) {
        console.error('Failed to notify hosts:', notifyError);
    }

    return {
        success: true,
        message: '✅ Meeting scheduled successfully.',
        meeting: {
            ...meeting.toObject(),
            formattedTime: start.toLocaleString('en-US', {
                timeZone: data.timezone,
                dateStyle: 'full',
                timeStyle: 'short',
            }),
        },
    };
}

export async function listMeetings(timeMin?: string) {
    const query = timeMin ? { startTime: { $gte: new Date(timeMin) } } : {};
    return await Meeting.find(query).sort({ startTime: 1 });
}

export async function getAvailableSlots(date: string, timezone: string = 'Asia/Dhaka') {
    const settings = await getAvailabilitySettings();
    const offset = timezone === 'Asia/Dhaka' ? '+06:00' : 'Z';

    // Create base date objects for the target day in the requested timezone
    // We iterate through office hours in 30 min intervals
    const slots: string[] = [];

    // Parse office hours (HH:mm)
    const [startH, startM] = settings.officeHours.start.split(':').map(Number);
    const [endH, endM] = settings.officeHours.end.split(':').map(Number);

    let currentH = startH;
    let currentM = startM;

    // Helper to format time HH:mm
    const formatTime = (h: number, m: number) =>
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    // Fetch existing meetings for the day to minimize db calls in loop
    // Approximate range: start of day to end of day
    const dayStart = new Date(`${date}T00:00:00${offset}`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const existingMeetings = await Meeting.find({
        startTime: { $gte: dayStart, $lt: dayEnd },
        status: { $ne: 'cancelled' }
    });

    while (currentH < endH || (currentH === endH && currentM < endM)) {
        const timeStr = formatTime(currentH, currentM);

        // Construct candidate slot start/end
        const slotStart = new Date(`${date}T${timeStr}:00${offset}`);
        const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

        // 1. Check if past (if date is today)
        if (slotStart < new Date()) {
            // Increment and continue
            currentM += 30;
            if (currentM >= 60) { currentH++; currentM -= 60; }
            continue;
        }

        // 2. Check breaks
        // Need to convert slot time to minutes for easy comparison with settings
        const slotStartMins = slotStart.getHours() * 60 + slotStart.getMinutes();
        const slotEndMins = slotEnd.getHours() * 60 + slotEnd.getMinutes();

        let inBreak = false;
        // Need to adjust break times which might be stored as HH:mm strings
        // Assuming break times in settings are relative to the timezone or "office timezone"
        // Since we are assuming office hours are in "local time" (Dhaka by default system design),
        // we compare local hours/mins.

        for (const b of settings.breaks) {
            const [bStartH, bStartM] = b.start.split(':').map(Number);
            const [bEndH, bEndM] = b.end.split(':').map(Number);
            const bStartTotal = bStartH * 60 + bStartM;
            const bEndTotal = bEndH * 60 + bEndM;

            if (
                (slotStartMins >= bStartTotal && slotStartMins < bEndTotal) ||
                (slotEndMins > bStartTotal && slotEndMins <= bEndTotal)
            ) {
                inBreak = true;
                break;
            }
        }

        if (inBreak) {
            currentM += 30;
            if (currentM >= 60) { currentH++; currentM -= 60; }
            continue;
        }

        // 3. Check overlaps with existing meetings
        const buffer = settings.meetingBuffer * 60 * 1000;
        const slotStartBuffer = new Date(slotStart.getTime() - buffer);
        const slotEndBuffer = new Date(slotEnd.getTime() + buffer);

        const hasOverlap = existingMeetings.some((m: IMeeting) => {
            return (m.startTime < slotEndBuffer && m.endTime > slotStartBuffer);
        });

        if (!hasOverlap) {
            slots.push(timeStr);
        }

        // Increment
        currentM += 30;
        if (currentM >= 60) { currentH++; currentM -= 60; }
    }

    return slots;
}

export async function deleteMeeting(meetingId: string) {
    await Meeting.findByIdAndDelete(meetingId);
    return '✅ Meeting deleted successfully.';
}
