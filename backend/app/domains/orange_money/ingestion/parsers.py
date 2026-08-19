"""Parsing des fichiers uploades vers une liste de lignes (list[dict]) --
seule cette couche connait le format source ; tout le reste du pipeline en
est independant. CSV et XLSX supportes nativement (pandas + openpyxl).
Parquet necessite pyarrow, non installe sur ce deploiement -- rejete avec un
message explicite plutot que de planter."""
import csv as csv_module
import io
from typing import Any, Dict, List

import pandas as pd

FORMATS_SUPPORTES = {".csv", ".xlsx", ".xls"}
DELIMITEURS_CANDIDATS = [",", ";", "\t", "|"]


class FormatNonSupporte(ValueError):
    pass


def _detecter_delimiteur(contenu: bytes) -> str:
    """Beaucoup d'exports Orange Money reels utilisent ';' plutot que ',' --
    imposer ',' rendait le fichier illisible (une seule colonne geante) sans
    aucune erreur explicite. csv.Sniffer avec repli sur le delimiteur le
    plus frequent de la premiere ligne si le sniffing echoue (ex: une seule
    colonne, ou motif ambigu)."""
    echantillon = contenu[:65536].decode("utf-8", errors="ignore")
    try:
        return csv_module.Sniffer().sniff(echantillon, delimiters="".join(DELIMITEURS_CANDIDATS)).delimiter
    except csv_module.Error:
        premiere_ligne = echantillon.split("\n", 1)[0]
        return max(DELIMITEURS_CANDIDATS, key=premiere_ligne.count)


def parser_fichier(nom_fichier: str, contenu: bytes) -> List[Dict[str, Any]]:
    if not nom_fichier or "." not in nom_fichier:
        raise FormatNonSupporte("Nom de fichier manquant ou sans extension.")

    extension = "." + nom_fichier.rsplit(".", 1)[-1].lower()

    if extension == ".csv":
        delimiteur = _detecter_delimiteur(contenu)
        df = pd.read_csv(io.BytesIO(contenu), sep=delimiteur)
    elif extension in (".xlsx", ".xls"):
        df = pd.read_excel(io.BytesIO(contenu))
    elif extension == ".parquet":
        raise FormatNonSupporte(
            "Format Parquet non activé sur ce déploiement (dépendance pyarrow non installée). "
            "Utilisez CSV ou XLSX."
        )
    else:
        raise FormatNonSupporte(f"Format de fichier non supporté : {extension}. Formats acceptés : CSV, XLSX.")

    # astype(object) d'abord : sur une colonne numerique (ex. montant avec des
    # cellules vides), pandas infere un dtype float64, et DataFrame.where ne
    # peut pas y stocker None -- la valeur retombe silencieusement a NaN. En
    # object, None est stocke tel quel. Sans ce passage, un NaN flottant se
    # propage jusqu'au JSON (non serialisable) et fausse les agregats (NaN
    # contamine toute somme/moyenne sans lever d'erreur).
    df = df.astype(object).where(df.notna(), None)
    return df.to_dict(orient="records")
