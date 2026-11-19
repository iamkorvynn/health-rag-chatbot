import 'package:flutter/material.dart';

import 'config.dart';
import 'models.dart';

/// Dark emerald + lime look from the new reference image:
/// near-black background, deep emerald gradients with glowing green blobs,
/// lime accent, big bold white headlines, muted gray-green body text.
/// Cards are dark glassy panels with subtle green-tinted borders.
/// Buttons are pill-shaped — lime-filled with dark text.
class AppTheme {
  static const Color lime = Color(0xFFC6F135);
  static const Color limeDeep = Color(0xFF9ACD32);
  static const Color emerald = Color(0xFF2E9E6B);
  static const Color emeraldDeep = Color(0xFF0E3B2C);
  static const Color background = Color(0xFF0A0E0C);
  static const Color surface = Color(0xFF101613);
  static const Color glass = Color(0xFF141B17);
  static const Color glassBorder = Color(0xFF22392D);
  static const Color ink = Color(0xFFFFFFFF);
  static const Color muted = Color(0xFF8FA398);
  static const Color onLime = Color(0xFF0B0F0E);

  static ThemeData get dark {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: ColorScheme.fromSeed(
        seedColor: lime,
        brightness: Brightness.dark,
        primary: lime,
        secondary: emerald,
        surface: surface,
      ),
      scaffoldBackgroundColor: background,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
          color: ink,
          fontSize: 20,
          fontWeight: FontWeight.w800,
        ),
        iconTheme: IconThemeData(color: ink),
      ),
      textTheme: const TextTheme(
        bodyMedium: TextStyle(color: ink),
        bodyLarge: TextStyle(color: ink),
        titleLarge: TextStyle(color: ink, fontWeight: FontWeight.w800),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: lime,
          foregroundColor: onLime,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(999),
          ),
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: ink,
          side: BorderSide(color: lime.withOpacity(0.5)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(999),
          ),
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24),
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: glass,
        hintStyle: const TextStyle(color: muted),
        labelStyle: const TextStyle(color: muted),
        prefixIconColor: muted,
        suffixIconColor: muted,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: glassBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: glassBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: lime, width: 1.5),
        ),
        contentPadding:
            const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: glass,
        labelStyle: const TextStyle(color: ink),
        side: BorderSide(color: lime.withOpacity(0.35)),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(999),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
    );
  }
}

/// Near-black background with glowing emerald blobs (the reference look).
class GradientBackground extends StatelessWidget {
  final Widget child;

  const GradientBackground({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Container(color: AppTheme.background),
        // Top-right emerald glow.
        Positioned(
          top: -120,
          right: -80,
          child: Container(
            width: 340,
            height: 340,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  AppTheme.emerald.withOpacity(0.45),
                  AppTheme.emerald.withOpacity(0.0),
                ],
              ),
            ),
          ),
        ),
        // Bottom-left emerald glow.
        Positioned(
          bottom: -140,
          left: -100,
          child: Container(
            width: 360,
            height: 360,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  AppTheme.emerald.withOpacity(0.32),
                  AppTheme.emerald.withOpacity(0.0),
                ],
              ),
            ),
          ),
        ),
        child,
      ],
    );
  }
}

/// Dark glassy card with a subtle green-tinted border (the reference look).
class RoundCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;

  const RoundCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final card = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: AppTheme.glass,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppTheme.glassBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.35),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: child,
    );
    if (onTap == null) return card;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: card,
    );
  }
}

/// Disclaimer strip, dark amber on the dark theme, shown on every screen.
class DisclaimerBanner extends StatelessWidget {
  const DisclaimerBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      color: const Color(0xFF2B2113),
      child: Row(
        children: [
          const Icon(Icons.info_outline,
              size: 16, color: Color(0xFFF0B429)),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              AppConfig.disclaimer,
              style: const TextStyle(
                fontSize: 11.5,
                color: Color(0xFFF0B429),
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Small pill used for source citations.
class SourceChip extends StatelessWidget {
  final Source source;
  final VoidCallback? onTap;

  const SourceChip({super.key, required this.source, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 10),
        decoration: BoxDecoration(
          color: AppTheme.glass,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.lime.withOpacity(0.35)),
        ),
        child: Text(
          '${source.file} (p.${source.page})',
          style: const TextStyle(
            fontSize: 12,
            color: AppTheme.lime,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
