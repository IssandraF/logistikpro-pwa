export function formatTerbilang(nilai: number): string {
  nilai = Math.abs(nilai);
  const huruf = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  let temp = "";
  
  if (nilai < 12) {
    temp = " " + huruf[nilai];
  } else if (nilai < 20) {
    temp = formatTerbilang(nilai - 10) + " Belas";
  } else if (nilai < 100) {
    temp = formatTerbilang(Math.floor(nilai / 10)) + " Puluh" + formatTerbilang(nilai % 10);
  } else if (nilai < 200) {
    temp = " Seratus" + formatTerbilang(nilai - 100);
  } else if (nilai < 1000) {
    temp = formatTerbilang(Math.floor(nilai / 100)) + " Ratus" + formatTerbilang(nilai % 100);
  } else if (nilai < 2000) {
    temp = " Seribu" + formatTerbilang(nilai - 1000);
  } else if (nilai < 1000000) {
    temp = formatTerbilang(Math.floor(nilai / 1000)) + " Ribu" + formatTerbilang(nilai % 1000);
  } else if (nilai < 1000000000) {
    temp = formatTerbilang(Math.floor(nilai / 1000000)) + " Juta" + formatTerbilang(nilai % 1000000);
  } else if (nilai < 1000000000000) {
    temp = formatTerbilang(Math.floor(nilai / 1000000000)) + " Milyar" + formatTerbilang(nilai % 1000000000);
  }
  
  return temp;
}

export function generateTerbilangText(nilai: number): string {
  const words = formatTerbilang(nilai).trim();
  return `# ${words.toUpperCase()} RUPIAH #`;
}

export function printWithTitle(title: string) {
  const originalTitle = document.title;
  document.title = title;
  window.print();
  setTimeout(() => {
    document.title = originalTitle;
  }, 1000);
}
