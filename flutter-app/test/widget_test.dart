import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:health_rag/api.dart';
import 'package:health_rag/screens/chat_screen.dart';
import 'package:health_rag/screens/login_screen.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Mock backend: only the endpoints these screens call.
http.Client mockBackend() {
  return MockClient((http.Request req) async {
    final path = req.url.path;
    if (path == '/auth/login') {
      final body = jsonDecode(req.body) as Map<String, dynamic>;
      if (body['username'] == 'doctor' &&
          body['password'] == 'doctor123') {
        return http.Response(
          jsonEncode({
            'access_token': 'fake-jwt',
            'token_type': 'bearer',
            'username': 'doctor',
            'role': 'doctor',
          }),
          200,
        );
      }
      return http.Response(
          jsonEncode({'detail': 'Invalid username or password.'}), 401);
    }
    if (path == '/ask') {
      return http.Response(
        jsonEncode({
          'answer': 'Rahul Mehta is allergic to Penicillin (rash, reported 2014).',
          'sources': [
            {
              'file': 'Patient_P1001_Rahul_Mehta.pdf',
              'page': 1,
              'text': 'Rahul Mehta is allergic to Penicillin (rash, reported 2014).',
              'score': 0.589,
            }
          ],
          'language': 'en',
        }),
        200,
      );
    }
    return http.Response('not found', 404);
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('Login screen', () {
    testWidgets('signs in with correct demo credentials',
        (tester) async {
      var loggedIn = false;
      final client = ApiClient(
        baseUrl: 'https://example.invalid',
        httpClient: mockBackend(),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: LoginScreen(
            client: client,
            onLoggedIn: () => loggedIn = true,
            onBaseUrlChanged: (_) {},
          ),
        ),
      );
      await tester.enterText(
          find.byKey(const Key('usernameField')), 'doctor');
      await tester.enterText(
          find.byKey(const Key('passwordField')), 'doctor123');
      await tester.tap(find.byKey(const Key('loginButton')));
      await tester.pumpAndSettle();
      expect(loggedIn, isTrue);
      expect(client.token, 'fake-jwt');
      expect(client.role, 'doctor');
    });

    testWidgets('shows an error for wrong credentials', (tester) async {
      final client = ApiClient(
        baseUrl: 'https://example.invalid',
        httpClient: mockBackend(),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: LoginScreen(
              client: client,
              onLoggedIn: () {},
              onBaseUrlChanged: (_) {},
            ),
        ),
      );
      await tester.enterText(
          find.byKey(const Key('usernameField')), 'doctor');
      await tester.enterText(
          find.byKey(const Key('passwordField')), 'wrong');
      await tester.tap(find.byKey(const Key('loginButton')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('loginError')), findsOneWidget);
      expect(find.text('Invalid username or password.'), findsOneWidget);
    });
  });

  group('Chat screen', () {
    testWidgets('asks a question and shows the answer with sources',
        (tester) async {
      final client = ApiClient(
        baseUrl: 'https://example.invalid',
        httpClient: mockBackend(),
      )..token = 'fake-jwt';
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ChatScreen(
              client: client,
              language: 'en',
              onLanguageChanged: (_) {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const Key('chatInput')),
          'What is Rahul Mehta allergic to?');
      await tester.tap(find.byKey(const Key('sendButton')));
      await tester.pumpAndSettle();
      expect(
        find.text(
            'Rahul Mehta is allergic to Penicillin (rash, reported 2014).'),
        findsOneWidget,
      );
      expect(find.text('Patient_P1001_Rahul_Mehta.pdf (p.1)'),
          findsOneWidget);
    });
  });
}
