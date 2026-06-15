import type { Team } from './database.types';
import { confederationColor } from './theme';

/**
 * A representative primary flag colour per team — used for the subtle gradient
 * tint on team cards. Falls back to the confederation accent for any id not
 * listed, so every team always resolves to a colour.
 */
const FLAG_COLOR: Record<string, string> = {
  mex: '#006847', // Mexico — green
  rsa: '#007A4D', // South Africa
  kor: '#003478', // South Korea — blue
  cze: '#11457E', // Czechia
  can: '#D52B1E', // Canada — red
  bih: '#002395', // Bosnia & Herzegovina
  qat: '#8A1538', // Qatar — maroon
  sui: '#D52B1E', // Switzerland
  bra: '#009C3B', // Brazil — green
  mar: '#C1272D', // Morocco
  hai: '#00209F', // Haiti — blue
  sco: '#0065BD', // Scotland
  usa: '#3C3B6E', // United States — blue
  par: '#0038A8', // Paraguay
  aus: '#00843D', // Australia — green/gold
  tur: '#E30A17', // Turkey — red
  ger: '#C8102E', // Germany — red/gold
  cuw: '#002B7F', // Curaçao
  civ: '#F77F00', // Ivory Coast — orange
  ecu: '#FFD100', // Ecuador — yellow
  ned: '#F36C21', // Netherlands — Oranje
  jpn: '#BC002D', // Japan — red
  swe: '#006AA7', // Sweden — blue
  tun: '#E70013', // Tunisia
  bel: '#C8102E', // Belgium
  egy: '#CE1126', // Egypt
  irn: '#239F40', // Iran — green
  nzl: '#00247D', // New Zealand
  esp: '#AA151B', // Spain — red
  cpv: '#003893', // Cape Verde
  ksa: '#006C35', // Saudi Arabia — green
  uru: '#0038A8', // Uruguay
  fra: '#0055A4', // France — blue
  sen: '#00853F', // Senegal — green
  irq: '#CE1126', // Iraq
  nor: '#BA0C2F', // Norway
  arg: '#75AADB', // Argentina — sky blue
  alg: '#006233', // Algeria — green
  aut: '#ED2939', // Austria — red
  jor: '#007A3D', // Jordan — green
  por: '#006600', // Portugal — green
  cod: '#00A2E8', // DR Congo — sky blue
  uzb: '#0099B5', // Uzbekistan
  col: '#FCD116', // Colombia — yellow
  eng: '#CE1124', // England — red
  cro: '#C8102E', // Croatia — red
  gha: '#006B3F', // Ghana — green
  pan: '#005293', // Panama — blue
};

/** Primary brand/flag colour for a team (gradient tint, accents). */
export function teamColor(team: Team | undefined): string {
  if (!team) return '#5A6684';
  return FLAG_COLOR[team.id] ?? confederationColor[team.confederation ?? ''] ?? '#5A6684';
}
