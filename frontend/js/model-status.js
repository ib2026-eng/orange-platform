import { API_OM_URL } from './config.js';

/* Statut reel du modele, interroge une seule fois (mis en cache). Utilise
   POST /predire_churn (avec un payload minimal, sans consequence) plutot
   que GET / : seul /predire_churn expose le champ modele_reel dans sa
   reponse -- GET / ne le renvoie pas (bug corrige ici : lire ce champ sur
   GET / renvoyait toujours false, meme modele reel actif). Voir
   docs/API_CONTRACT.md. */

let promesse = null;

export function obtenirStatutModele() {
  if (!promesse) {
    promesse = fetch(API_OM_URL + '/predire_churn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ montant_moyen: 0 }),
    })
      .then(res => res.json())
      .then(data => ({ modeleReel: !!data.modele_reel, statut: data.note_fiabilite }))
      .catch(() => ({ modeleReel: null, statut: null }));
  }
  return promesse;
}
