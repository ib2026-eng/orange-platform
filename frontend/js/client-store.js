import { API_OM_URL } from './config.js';

/* Source unique de verite pour toutes les vues (Vue globale, Segmentation,
   Clients a risque, Fiche client, Next Best Action) : le dataset ACTIF
   cote backend (voir /data/status, /data/clients). Plus de generation
   fictive cote client -- si aucun dataset n'est actif, le roster est vide
   et chaque vue affiche son etat vide professionnel.

   Emet 'roster:ready' (persistant, pas une seule fois) a chaque
   changement : chargement initial, apres validation d'un import, apres
   suppression du dataset actif. */

let roster = [];
let etat = 'chargement'; // 'chargement' | 'vide' | 'pret' | 'insuffisant' | 'erreur'
let messageEtat = '';

export function obtenirRoster() {
  return roster;
}

export function obtenirEtatRoster() {
  return { etat, message: messageEtat };
}

export function trouverClientParId(id) {
  return roster.find(c => c.id === id);
}

function notifier() {
  document.dispatchEvent(new CustomEvent('roster:ready', { detail: { taille: roster.length, etat } }));
}

export async function rafraichirRoster() {
  etat = 'chargement';
  try {
    const resStatut = await fetch(API_OM_URL + '/data/status');
    const statut = await resStatut.json();

    if (statut.source !== 'importe') {
      roster = [];
      etat = 'vide';
      messageEtat = '';
      notifier();
      return;
    }

    const res = await fetch(API_OM_URL + '/data/clients');
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      roster = [];
      etat = 'insuffisant';
      messageEtat = body.detail || 'Données insuffisantes pour cette analyse.';
      notifier();
      return;
    }

    const body = await res.json();
    roster = body.resultats;
    etat = 'pret';
    messageEtat = '';
    notifier();
  } catch (err) {
    roster = [];
    etat = 'erreur';
    messageEtat = "API indisponible -- impossible de charger le dataset actif.";
    notifier();
  }
}

export function initClientStore() {
  rafraichirRoster();
}
