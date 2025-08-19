import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let twilioClient: twilio.Twilio | null = null;

// Initialize Twilio client if credentials are available
if (accountSid && authToken && fromPhoneNumber) {
  try {
    twilioClient = twilio(accountSid, authToken);
    console.log('✅ Twilio client initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Twilio client:', error);
  }
} else {
  console.log('⚠️  Twilio credentials not found. SMS functionality will be disabled.');
}

export async function sendSMS(phoneNumber: string, message: string): Promise<boolean> {
  if (!twilioClient || !fromPhoneNumber) {
    console.log('⚠️  Twilio not configured - SMS not sent');
    return false;
  }

  try {
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber}`;
    
    await twilioClient.messages.create({
      body: message,
      from: fromPhoneNumber,
      to: formattedPhone,
    });
    
    console.log(`📱 SMS sent successfully to ${formattedPhone}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send SMS:', error);
    return false;
  }
}

export async function testSMSConnection(phoneNumber: string): Promise<boolean> {
  const testMessage = '🏀 ChirpBot SMS Test - Your sports alerts are now connected!';
  return await sendSMS(phoneNumber, testMessage);
}

export function formatAlertForSMS(alert: {
  type: string;
  sport: string;
  title: string;
  description: string;
  gameInfo?: any;
}): string {
  const sportEmoji = {
    'MLB': '⚾',
    'NFL': '🏈', 
    'NBA': '🏀',
    'NHL': '🏒'
  }[alert.sport] || '🚨';

  // Keep SMS concise - under 160 characters when possible
  return `${sportEmoji} ${alert.type}\n${alert.title}\n${alert.description}`;
}