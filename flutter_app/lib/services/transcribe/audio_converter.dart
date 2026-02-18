import 'dart:io';
import 'package:ffmpeg_kit_flutter_new_min/ffmpeg_kit.dart';
import 'package:ffmpeg_kit_flutter_new_min/return_code.dart';
import '../../core/app_logger.dart';

/// 音声フォーマット変換サービス
///
/// Whisper.cpp が要求する 16kHz mono WAV に変換する。
class AudioConverter {
  const AudioConverter();

  /// m4a → 16kHz mono WAV に変換
  ///
  /// [inputPath] 入力ファイルパス (m4a)
  /// 戻り値: WAVファイルパス（入力ファイルと同ディレクトリ）
  /// 変換後の一時WAVファイルは呼び出し側で削除すること。
  Future<String> convertToWav(String inputPath) async {
    final outputPath = '${inputPath.replaceAll(RegExp(r'\.[^.]+$'), '')}.wav';

    AppLogger.recording(
      'AudioConverter: converting $inputPath -> $outputPath',
    );

    final session = await FFmpegKit.execute(
      '-i "$inputPath" -ar 16000 -ac 1 -c:a pcm_s16le -y "$outputPath"',
    );

    final returnCode = await session.getReturnCode();
    if (!ReturnCode.isSuccess(returnCode)) {
      final logs = await session.getLogsAsString();
      throw AudioConverterException(
        'WAV変換失敗 (returnCode=${returnCode?.getValue()}): $logs',
      );
    }

    final outputFile = File(outputPath);
    if (!await outputFile.exists()) {
      throw AudioConverterException('変換後ファイルが存在しません: $outputPath');
    }

    AppLogger.recording(
      'AudioConverter: conversion complete size=${await outputFile.length()}',
    );

    return outputPath;
  }
}

/// 音声変換例外
class AudioConverterException implements Exception {
  final String message;

  AudioConverterException(this.message);

  @override
  String toString() => message;
}
