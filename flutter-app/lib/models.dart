/// Plain data classes for the Health RAG backend responses.
/// Kept simple on purpose (student-level code, same style as the project).
class Patient {
  final String id;
  final String name;
  final String file;

  const Patient({required this.id, required this.name, required this.file});

  factory Patient.fromJson(Map<String, dynamic> json) => Patient(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        file: json['file'] as String? ?? '',
      );
}

class Source {
  final String file;
  final int page;
  final String text;
  final double score;

  const Source(
      {required this.file,
      required this.page,
      required this.text,
      required this.score});

  factory Source.fromJson(Map<String, dynamic> json) => Source(
        file: json['file'] as String? ?? '',
        page: (json['page'] as num?)?.toInt() ?? 0,
        text: json['text'] as String? ?? '',
        score: (json['score'] as num?)?.toDouble() ?? 0,
      );

  Map<String, dynamic> toJson() =>
      {'file': file, 'page': page, 'text': text, 'score': score};
}

class ChatMessage {
  final bool isUser;
  final String text;
  final List<Source> sources;
  final DateTime time;

  const ChatMessage(
      {required this.isUser,
      required this.text,
      this.sources = const [],
      required this.time});

  Map<String, dynamic> toJson() => {
        'isUser': isUser,
        'text': text,
        'sources': sources.map((s) => s.toJson()).toList(),
        'time': time.toIso8601String(),
      };

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        isUser: json['isUser'] as bool? ?? false,
        text: json['text'] as String? ?? '',
        sources: (json['sources'] as List? ?? [])
            .map((s) => Source.fromJson(s as Map<String, dynamic>))
            .toList(),
        time: DateTime.tryParse(json['time'] as String? ?? '') ??
            DateTime.now(),
      );
}

class TokenQueue {
  final TokenEntry? current;
  final List<TokenEntry> waiting;
  final int servedCount;

  const TokenQueue(
      {this.current, this.waiting = const [], this.servedCount = 0});

  factory TokenQueue.fromJson(Map<String, dynamic> json) => TokenQueue(
        current: json['current'] == null
            ? null
            : TokenEntry.fromJson(json['current'] as Map<String, dynamic>),
        waiting: (json['waiting'] as List? ?? [])
            .map((t) => TokenEntry.fromJson(t as Map<String, dynamic>))
            .toList(),
        servedCount: (json['served_count'] as num?)?.toInt() ?? 0,
      );
}

class TokenEntry {
  final int number;
  final String name;
  final String? createdAt;

  const TokenEntry({required this.number, required this.name, this.createdAt});

  factory TokenEntry.fromJson(Map<String, dynamic> json) => TokenEntry(
        number: (json['number'] as num?)?.toInt() ?? 0,
        name: json['name'] as String? ?? '',
        createdAt: json['created_at'] as String?,
      );
}

class VisitInfo {
  final String timings;
  final String fees;
  final String emergency;
  final String sourceFile;

  const VisitInfo(
      {required this.timings,
      required this.fees,
      required this.emergency,
      required this.sourceFile});

  factory VisitInfo.fromJson(Map<String, dynamic> json) => VisitInfo(
        timings: json['timings'] as String? ?? '',
        fees: json['fees'] as String? ?? '',
        emergency: json['emergency'] as String? ?? '',
        sourceFile: json['source_file'] as String? ?? '',
      );
}

class AdminStats {
  final int documentsIndexed;
  final int questionsAsked;
  final double fallbackRate;
  final List<Map<String, dynamic>> recentQueries;

  const AdminStats(
      {required this.documentsIndexed,
      required this.questionsAsked,
      required this.fallbackRate,
      this.recentQueries = const []});

  factory AdminStats.fromJson(Map<String, dynamic> json) => AdminStats(
        documentsIndexed: (json['documents_indexed'] as num?)?.toInt() ?? 0,
        questionsAsked: (json['questions_asked'] as num?)?.toInt() ?? 0,
        fallbackRate: (json['fallback_rate'] as num?)?.toDouble() ?? 0,
        recentQueries: (json['recent_queries'] as List? ?? [])
            .map((q) => Map<String, dynamic>.from(q as Map))
            .toList(),
      );
}

class TestQuestion {
  final int id;
  final String question;
  final String expected;

  const TestQuestion(
      {required this.id, required this.question, required this.expected});

  factory TestQuestion.fromJson(Map<String, dynamic> json) => TestQuestion(
        id: (json['id'] as num?)?.toInt() ?? 0,
        question: json['question'] as String? ?? '',
        expected: json['expected'] as String? ?? '',
      );
}
