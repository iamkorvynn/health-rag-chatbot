/// App-wide constants for the Health RAG Chatbot (Sunrise Family Clinic).
///
/// The backend URL is the public tunnel URL. The tunnel rotates its free
/// subdomain when it reconnects, so the app lets the user change this URL in
/// Settings — the value here is only the default. Never put the Gemini API
/// key (or any secret) in this app: the key lives only on the backend.
class AppConfig {
  static const String appName = 'Health RAG';
  static const String clinicName = 'Sunrise Family Clinic';
  static const String appVersion = '1.0.0';

  /// Default API base URL (current public tunnel, 2026-11-18).
  /// Changeable in Settings -> API base URL; persisted on device.
  static const String defaultBaseUrl =
      'https://b38a2190b5fa68.app.lhr.life';

  static const String disclaimer =
      'Decision-support only, not a replacement for a doctor. '
      'Synthetic demo data — not real patient records.';

  /// Language codes the backend /ask endpoint accepts.
  static const Map<String, String> languages = {
    'en': 'English',
    'hi': 'Hindi',
    'mr': 'Marathi',
  };

  /// Speech-to-text locale per language.
  static const Map<String, String> speechLocales = {
    'en': 'en-IN',
    'hi': 'hi-IN',
    'mr': 'mr-IN',
  };
}
