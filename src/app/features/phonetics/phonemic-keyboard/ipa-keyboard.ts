import { NgTemplateOutlet } from '@angular/common';
import { Component, output } from '@angular/core';
import {
  PhonemeInfo,
  phonemeInfo,
  PRIMARY_STRESS,
  SECONDARY_STRESS,
} from '../../../../../shared/phoneme-inventory';

/**
 * Teclado en pantalla con los 44 fonemas del RP, ordenados como la tabla fonémica de
 * Adrian Underhill (la del British Council) que se usa en los profesorados:
 * monoptongos a la izquierda, diptongos a la derecha y consonantes abajo en pares sorda/sonora.
 */

const MONOPHTHONG_ROWS = [
  ['iː', 'ɪ', 'ʊ', 'uː'],
  ['e', 'ə', 'ɜː', 'ɔː'],
  ['æ', 'ʌ', 'ɑː', 'ɒ'],
];

const DIPHTHONG_ROWS = [
  ['ɪə', 'eɪ'],
  ['ʊə', 'ɔɪ', 'əʊ'],
  ['eə', 'aɪ', 'aʊ'],
];

const CONSONANT_ROWS = [
  ['p', 'b', 't', 'd', 'tʃ', 'dʒ', 'k', 'ɡ'],
  ['f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ'],
  ['m', 'n', 'ŋ', 'h', 'l', 'r', 'w', 'j'],
];

const toInfo = (rows: string[][]): PhonemeInfo[][] =>
  rows.map((row) => row.map((s) => phonemeInfo(s)!));

@Component({
  selector: 'app-ipa-keyboard',
  imports: [NgTemplateOutlet],
  templateUrl: './ipa-keyboard.html',
  styleUrl: './ipa-keyboard.css',
})
export class IpaKeyboard {
  /** Se apretó una tecla de fonema o de acento. */
  readonly pressed = output<string>();
  /** Clic derecho sobre una tecla: escuchar la palabra de ejemplo. */
  readonly exampleRequested = output<PhonemeInfo>();
  readonly backspace = output<void>();
  readonly clear = output<void>();

  protected readonly monophthongs = toInfo(MONOPHTHONG_ROWS);
  protected readonly diphthongs = toInfo(DIPHTHONG_ROWS);
  protected readonly consonants = toInfo(CONSONANT_ROWS);
  protected readonly weakVowels = toInfo([['i', 'u']])[0];
  protected readonly primaryStress = PRIMARY_STRESS;
  protected readonly secondaryStress = SECONDARY_STRESS;

  protected tooltip(p: PhonemeInfo): string {
    const kind =
      p.category === 'consonant' ? `${p.keyword} ${p.voiced ? 'sonora' : 'sorda'}` : p.keyword;
    return `/${p.symbol}/ — ${kind} — como en «${p.example}». Clic derecho: escuchar «${p.example}».`;
  }

  protected requestExample(event: MouseEvent, p: PhonemeInfo): void {
    event.preventDefault();
    this.exampleRequested.emit(p);
  }
}
