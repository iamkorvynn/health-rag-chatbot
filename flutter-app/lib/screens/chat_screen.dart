import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:speech_to_text/speech_to_text.dart';

import '../api.dart';
import '../config.dart';
import '../models.dart';
import '../theme.dart';

/// Chat tab: ask questions, get answers with sources + highlighted excerpts.
/// History is saved on-device. Voice input via speech-to-text, and the
/// answer language follows the selector (English / Hindi / Marathi).
class ChatScreen extends StatefulWidget {
  final ApiClient client;
  final String language;
  final ValueChanged<String> onLanguageChanged;

  const ChatScreen({
    super.key,
    required this.client,
    required this.language,
    required this.onLanguageChanged,
  });

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _inputController = TextEditingController();
  final _scrollController = ScrollController();
  final _speech = SpeechToText();
  List<ChatMessage> _messages = [];
  bool _sending = false;
  bool _listening = false;
  bool _speechReady = false;
  String? _error;

  static const List<String> _suggested = [
    'What is Rahul Mehta allergic to?',
    'List all my patients',
    'What are the clinic timings on Saturday?',
    'What is the first consultation fee?',
  ];

  @override
  void initState() {
    super.initState();
    _loadHistory();
    _initSpeech();
  }

  Future<void> _initSpeech() async {
    try {
      _speechReady = await _speech.initialize();
    } catch (_) {
      _speechReady = false;
    }
    if (mounted) setState(() {});
  }

  Future<void> _loadHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('chat_history');
    if (raw == null) return;
    try {
      final list = (jsonDecode(raw) as List)
          .map((m) => ChatMessage.fromJson(m as Map<String, dynamic>))
          .toList();
      if (mounted) setState(() => _messages = list);
    } catch (_) {}
  }

  Future<void> _saveHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final trimmed =
        _messages.length > 50 ? _messages.sublist(_messages.length - 50) : _messages;
    await prefs.setString(
        'chat_history', jsonEncode(trimmed.map((m) => m.toJson()).toList()));
  }

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollDown() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _send([String? text]) async {
    final question = (text ?? _inputController.text).trim();
    if (question.isEmpty || _sending) return;
    _inputController.clear();
    setState(() {
      _sending = true;
      _error = null;
      _messages.add(ChatMessage(
          isUser: true, text: question, time: DateTime.now()));
    });
    _scrollDown();
    try {
      final result = await widget.client.ask(question, widget.language);
      if (!mounted) return;
      setState(() {
        _messages.add(ChatMessage(
          isUser: false,
          text: result.answer,
          sources: result.sources,
          time: DateTime.now(),
        ));
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not reach the server. $e');
    } finally {
      if (mounted) {
        setState(() => _sending = false);
        _saveHistory();
        _scrollDown();
      }
    }
  }

  Future<void> _toggleListening() async {
    if (_listening) {
      await _speech.stop();
      setState(() => _listening = false);
      return;
    }
    if (!_speechReady) {
      setState(() => _error = 'Voice input is not available on this device.');
      return;
    }
    final locale = AppConfig.speechLocales[widget.language] ?? 'en-IN';
    setState(() => _listening = true);
    await _speech.listen(
      localeId: locale,
      onResult: (result) {
        _inputController.text = result.recognizedWords;
      },
    );
    setState(() => _listening = false);
  }

  Future<void> _clearHistory() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('chat_history');
    setState(() => _messages = []);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Row(
            children: [
              const Icon(Icons.chat_bubble_outline,
                  color: AppTheme.lime, size: 20),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Ask about the clinic records',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.ink,
                  ),
                ),
              ),
              // Answer language.
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                decoration: BoxDecoration(
                  color: AppTheme.glass,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.lime.withOpacity(0.3)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: widget.language,
                    icon: const Icon(Icons.language, size: 18),
                    items: AppConfig.languages.entries
                        .map((e) => DropdownMenuItem(
                              value: e.key,
                              child: Text(e.value,
                                  style: const TextStyle(fontSize: 13)),
                            ))
                        .toList(),
                    onChanged: (v) {
                      if (v != null) widget.onLanguageChanged(v);
                    },
                  ),
                ),
              ),
              IconButton(
                key: const Key('clearHistoryButton'),
                icon: const Icon(Icons.delete_sweep_outlined),
                tooltip: 'Clear chat history',
                onPressed: _messages.isEmpty ? null : _clearHistory,
              ),
            ],
          ),
        ),
        if (_messages.isEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _suggested
                  .map((q) => ActionChip(
                        key: Key('suggested-$q'),
                        label: Text(q, style: const TextStyle(fontSize: 12)),
                        onPressed: () => _send(q),
                        backgroundColor: AppTheme.glass,
                        side: BorderSide(
                            color: AppTheme.lime.withOpacity(0.3)),
                      ))
                  .toList(),
            ),
          ),
        Expanded(
          child: _messages.isEmpty
              ? const Center(
                  child: Text(
                    'Ask about a patient, a medicine,\nor the clinic — I answer only\nfrom the clinic records.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppTheme.muted, fontSize: 15),
                  ),
                )
              : ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.all(16),
                  itemCount: _messages.length,
                  itemBuilder: (context, i) => _MessageBubble(
                    message: _messages[i],
                    queryWords: i > 0 && !_messages[i].isUser
                        ? _queryWords(_messages[i - 1].text)
                        : const [],
                  ),
                ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              _error!,
              style: const TextStyle(color: Colors.red),
            ),
          ),
        if (_sending)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2)),
                SizedBox(width: 8),
                Text('Searching the clinic records…',
                    style: TextStyle(color: AppTheme.muted)),
              ],
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  key: const Key('chatInput'),
                  controller: _inputController,
                  decoration: const InputDecoration(
                    hintText: 'Ask a question…',
                  ),
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => _send(),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                decoration: BoxDecoration(
                  color: _listening ? AppTheme.lime : AppTheme.glass,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.lime.withOpacity(0.12),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: IconButton(
                  key: const Key('micButton'),
                  icon: Icon(
                    _listening ? Icons.mic : Icons.mic_none,
                    color: _listening ? AppTheme.onLime : AppTheme.lime,
                  ),
                  tooltip: 'Voice input',
                  onPressed: _toggleListening,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                decoration: const BoxDecoration(
                  color: AppTheme.lime,
                  shape: BoxShape.circle,
                ),
                child: IconButton(
                  key: const Key('sendButton'),
                  icon: const Icon(Icons.send, color: AppTheme.onLime),
                  onPressed: _sending ? null : () => _send(),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Words worth highlighting in source excerpts (skip short stop-words).
  static List<String> _queryWords(String question) {
    return question
        .toLowerCase()
        .split(RegExp(r'[^a-z]+'))
        .where((w) => w.length >= 4)
        .toSet()
        .toList();
  }
}

/// One chat bubble. Bot answers show source chips + expandable excerpts
/// with the question's words highlighted.
class _MessageBubble extends StatefulWidget {
  final ChatMessage message;
  final List<String> queryWords;

  const _MessageBubble({required this.message, required this.queryWords});

  @override
  State<_MessageBubble> createState() => _MessageBubbleState();
}

class _MessageBubbleState extends State<_MessageBubble> {
  bool _showSources = false;

  @override
  Widget build(BuildContext context) {
    final msg = widget.message;
    final align =
        msg.isUser ? Alignment.centerRight : Alignment.centerLeft;
    final color = msg.isUser ? AppTheme.lime : AppTheme.glass;
    final textColor = msg.isUser ? AppTheme.onLime : AppTheme.ink;
    return Align(
      alignment: align,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
        constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.85),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: AppTheme.lime.withOpacity(0.08),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(msg.text,
                style: TextStyle(color: textColor, fontSize: 15)),
            if (!msg.isUser && msg.sources.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: msg.sources
                    .map((s) => SourceChip(source: s))
                    .toList(),
              ),
              TextButton(
                onPressed: () =>
                    setState(() => _showSources = !_showSources),
                child: Text(
                  _showSources ? 'Hide excerpts' : 'Show excerpts',
                  style: const TextStyle(fontSize: 12),
                ),
              ),
              if (_showSources)
                ...msg.sources.map((s) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0C120E),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color: AppTheme.lime.withOpacity(0.15)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${s.file} — p.${s.page} · score ${s.score}',
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.limeDeep,
                              ),
                            ),
                            const SizedBox(height: 4),
                            _HighlightedText(
                              text: s.text,
                              words: widget.queryWords,
                            ),
                          ],
                        ),
                      ),
                    )),
            ],
          ],
        ),
      ),
    );
  }
}

/// Text with the question's words highlighted in purple.
class _HighlightedText extends StatelessWidget {
  final String text;
  final List<String> words;

  const _HighlightedText({required this.text, required this.words});

  @override
  Widget build(BuildContext context) {
    if (words.isEmpty) {
      return Text(text, style: const TextStyle(fontSize: 13));
    }
    final pattern = RegExp(
      '(${words.map(RegExp.escape).join('|')})',
      caseSensitive: false,
    );
    final spans = <TextSpan>[];
    var start = 0;
    for (final m in pattern.allMatches(text)) {
      if (m.start > start) {
        spans.add(TextSpan(text: text.substring(start, m.start)));
      }
      spans.add(TextSpan(
        text: m.group(0),
        style: const TextStyle(
          fontWeight: FontWeight.w700,
          color: AppTheme.lime,
          backgroundColor: Color(0xFF3A4A1E),
        ),
      ));
      start = m.end;
    }
    if (start < text.length) {
      spans.add(TextSpan(text: text.substring(start)));
    }
    return RichText(
      text: TextSpan(
        style: const TextStyle(fontSize: 13, color: AppTheme.ink),
        children: spans,
      ),
    );
  }
}
