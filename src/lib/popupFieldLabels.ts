export const popupFieldLabelSuggestions: Record<string, string> = {
  NAMOBJ: "Nama",
  WADMKK: "Kabupaten",
  WADMKC: "Kecamatan",
  WADMKD: "Desa",
  RANGENILAI: "Rentang Nilai",
  LUAS: "Luas",
  LUASHA: "Luas Ha",
  KELAS: "Kelas",
  KETERANGAN: "Keterangan",
  TAHUN: "Tahun"
};

export function suggestedPopupFieldLabel(fieldKey: string): string | null {
  const normalized = fieldKey.trim().toUpperCase();
  return popupFieldLabelSuggestions[normalized] || null;
}
