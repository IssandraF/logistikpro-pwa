import { format } from "date-fns";
import { id } from "date-fns/locale";
import { generateTerbilangText } from "@/lib/print-utils";
import type { Invoice, DailyContract, DailyTimesheet, Owner, Proyek } from "@/lib/db";

interface PrintDailyInvoiceProps {
  invoice: Invoice;
  contract?: DailyContract;
  timesheets: DailyTimesheet[];
  owner?: Owner;
  proyek?: Proyek;
  includePhotos?: boolean;
  paperSize?: string;
  printScale?: number;
  isPreview?: boolean;
}

export default function PrintDailyInvoice({
  invoice,
  contract,
  timesheets,
  owner,
  proyek,
  includePhotos = false,
  paperSize = 'A4 portrait',
  printScale = 100,
  isPreview = false
}: PrintDailyInvoiceProps) {

  // Sort timesheets by date ascending
  const sortedTs = [...timesheets].sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

  // Group timesheets by Nopol
  const groupedByNopol = sortedTs.reduce((acc, t) => {
    if (!acc[t.plat_nomor]) {
      acc[t.plat_nomor] = [];
    }
    acc[t.plat_nomor].push(t);
    return acc;
  }, {} as Record<string, DailyTimesheet[]>);

  // Group timesheets by Nopol and Lokasi Detail
  const nopolList = Object.keys(groupedByNopol);

  // Financial calculations
  const tarifHarian = contract?.tarif_harian || 1600000;
  const totalHari = sortedTs.reduce((sum, t) => sum + (t.jumlah_hari || 1), 0);
  const totalKotor = invoice.total_harga_kotor || (totalHari * tarifHarian);
  const pphPersen = invoice.pph_persen ?? (contract?.pph_persen ?? 2);
  const totalPph = invoice.total_pph ?? (totalKotor * (pphPersen / 100));
  const totalNett = invoice.total_harga_bersih || (totalKotor - totalPph);

  const terbilangText = generateTerbilangText(totalNett) + " Rupiah";

  const getPaperDimensions = () => {
    switch (paperSize) {
      case 'F4 portrait': return { width: '210mm', minHeight: '330mm' };
      case 'A4 landscape': return { width: '297mm', minHeight: '210mm' };
      case 'A5 portrait': return { width: '148mm', minHeight: '210mm' };
      default: return { width: '210mm', minHeight: '297mm' }; // A4 portrait
    }
  };

  const dim = getPaperDimensions();

  const printContainerStyle: React.CSSProperties = isPreview ? {
    width: '100%',
    maxWidth: dim.width,
    margin: '0 auto',
    backgroundColor: '#ffffff',
    color: '#000000',
    fontSize: '11pt',
    fontFamily: 'Arial, sans-serif',
    lineHeight: '1.4',
    padding: '15mm 20mm',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  } : {
    width: dim.width,
    minHeight: dim.minHeight,
    backgroundColor: '#ffffff',
    color: '#000000',
    fontSize: '11pt',
    fontFamily: 'Arial, sans-serif',
    lineHeight: '1.4',
    padding: '15mm 20mm',
    boxSizing: 'border-box',
    transform: printScale !== 100 ? `scale(${printScale / 100})` : undefined,
    transformOrigin: 'top left'
  };

  const bankNama = invoice.rekening_bank || (contract?.bank_nama ? `${contract.bank_nama} ${contract.bank_rekening}` : owner?.nama_bank ? `${owner.nama_bank} ${owner.no_rek}` : 'Mandiri 1080030788005');
  const bankAn = contract?.bank_atas_nama || owner?.atas_nama || 'Irma Fitriani Dalimunte';

  return (
    <div className={isPreview ? "invoice-preview-wrapper bg-white text-black p-4" : "hidden print:block invoice-print-container"} style={printContainerStyle}>
      <style type="text/css" media="print">
        {`
          @page {
            size: ${paperSize} !important;
            margin: 5mm;
          }
          .invoice-print-container {
            zoom: ${printScale / 100} !important;
          }
          .page-break-before {
            page-break-before: always !important;
            break-before: page !important;
          }
        `}
      </style>

      {/* HEADER PERUSAHAAN / PEMILIK ALAT */}
      <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wide">
            {contract?.pihak_pertama_nama || owner?.nama || 'NOVID CHANDRA'}
          </h1>
          <p className="text-xs text-gray-700 font-medium">PEMILIK / PENYEDIA DUMP TRUCK</p>
          {contract?.pihak_pertama_alamat && (
            <p className="text-xs text-gray-600 max-w-sm mt-0.5">{contract.pihak_pertama_alamat}</p>
          )}
          {contract?.pihak_pertama_hp && (
            <p className="text-xs text-gray-600">HP / WA: {contract.pihak_pertama_hp}</p>
          )}
        </div>
        <div className="text-right">
          <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">INVOICE SEWA HARIAN</h2>
          <p className="text-sm font-semibold text-gray-800 mt-1">No: {invoice.nomor_invoice}</p>
          <p className="text-xs text-gray-600">Tanggal: {format(new Date(invoice.tanggal_invoice), 'dd MMMM yyyy', { locale: id })}</p>
          {contract?.nomor_kontrak && (
            <p className="text-xs font-semibold text-blue-800 mt-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block">
              Ref Kontrak: {contract.nomor_kontrak}
            </p>
          )}
        </div>
      </div>

      {/* REKAP KEPADA / PROYEK */}
      <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-3 rounded border border-gray-200 text-xs">
        <div>
          <p className="text-gray-500 font-semibold uppercase text-[10px] mb-1">Ditujukan Kepada (Penyewa):</p>
          <p className="font-bold text-sm text-gray-900">{contract?.pihak_kedua_nama || invoice.kepada_custom || 'Ridzat Ali Murphi'}</p>
          {contract?.pihak_kedua_alamat && <p className="text-gray-700">{contract.pihak_kedua_alamat}</p>}
          {contract?.pihak_kedua_hp && <p className="text-gray-700">HP: {contract.pihak_kedua_hp}</p>}
        </div>
        <div>
          <p className="text-gray-500 font-semibold uppercase text-[10px] mb-1">Lokasi & Pekerjaan Proyek:</p>
          <p className="font-bold text-sm text-gray-900">{proyek?.nama_proyek || 'Pembangunan Jalan Tol Trans Sumatera'}</p>
          {contract?.lokasi_proyek_nama && <p className="text-gray-700 font-medium">Lokasi: {contract.lokasi_proyek_nama}</p>}
        </div>
      </div>

      {/* TABEL BARIS PENAGIHAN (LINE ITEMS PER NOPOL) */}
      <table className="w-full text-xs border-collapse border border-gray-300 mb-4">
        <thead>
          <tr className="bg-gray-100 text-gray-800 uppercase font-bold text-[10px] text-center border-b border-gray-300">
            <th className="p-2 border-r border-gray-300 w-10">No</th>
            <th className="p-2 border-r border-gray-300 text-left">Deskripsi Sewa Unit</th>
            <th className="p-2 border-r border-gray-300 w-28">Nopol Unit</th>
            <th className="p-2 border-r border-gray-300 w-36">Periode Kerja</th>
            <th className="p-2 border-r border-gray-300 w-20">Jumlah</th>
            <th className="p-2 border-r border-gray-300 text-right w-28">Tarif / Hari</th>
            <th className="p-2 text-right w-32">Total Gross</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {nopolList.map((nopol, index) => {
            const unitTs = groupedByNopol[nopol];
            const unitDays = unitTs.reduce((s, t) => s + (t.jumlah_hari || 1), 0);
            const firstDate = unitTs[0]?.tanggal ? format(new Date(unitTs[0].tanggal), 'dd/MM/yy') : '';
            const lastDate = unitTs[unitTs.length - 1]?.tanggal ? format(new Date(unitTs[unitTs.length - 1].tanggal), 'dd/MM/yy') : '';
            const periodStr = firstDate === lastDate ? firstDate : `${firstDate} - ${lastDate}`;
            const subtotalUnit = unitDays * tarifHarian;

            return (
              <tr key={nopol} className="hover:bg-gray-50">
                <td className="p-2 border-r border-gray-300 text-center font-medium">{index + 1}</td>
                <td className="p-2 border-r border-gray-300">
                  <p className="font-semibold text-gray-900">Sewa Alat Dump Truck Index 28</p>
                  <p className="text-[10px] text-gray-600">
                    Lokasi: {Array.from(new Set(unitTs.map(t => t.lokasi_detail))).join(', ')}
                  </p>
                </td>
                <td className="p-2 border-r border-gray-300 font-mono font-bold text-center">{nopol}</td>
                <td className="p-2 border-r border-gray-300 text-center">{periodStr}</td>
                <td className="p-2 border-r border-gray-300 text-center font-semibold">{unitDays} Hari</td>
                <td className="p-2 border-r border-gray-300 text-right">Rp {tarifHarian.toLocaleString('id-ID')}</td>
                <td className="p-2 text-right font-semibold">Rp {subtotalUnit.toLocaleString('id-ID')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* FINANCIAL SUMMARY TABLE */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
        <div className="flex-1 bg-gray-50 p-3 rounded border border-gray-200 w-full sm:w-auto">
          <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Terbilang Pembayaran:</p>
          <p className="text-xs font-semibold italic text-gray-800 leading-snug">
            "{terbilangText}"
          </p>

          <div className="mt-3 pt-2 border-t border-gray-200">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Instruksi Pembayaran Transfer Bank:</p>
            <p className="text-xs font-bold text-gray-900">Bank: {bankNama}</p>
            <p className="text-xs font-semibold text-gray-800">Atas Nama: {bankAn}</p>
          </div>
        </div>

        <div className="w-full sm:w-64 text-xs space-y-1.5 border border-gray-300 p-3 rounded bg-white">
          <div className="flex justify-between font-semibold text-gray-700">
            <span>Subtotal Kotor:</span>
            <span>Rp {totalKotor.toLocaleString('id-ID')}</span>
          </div>
          {pphPersen > 0 && (
            <div className="flex justify-between text-gray-600 text-[11px]">
              <span>Potongan PPh {pphPersen}%:</span>
              <span>- Rp {totalPph.toLocaleString('id-ID')}</span>
            </div>
          )}
          <div className="border-t border-gray-300 pt-1.5 flex justify-between font-bold text-sm text-gray-900">
            <span>Total Nett Pembayaran:</span>
            <span className="text-emerald-700">Rp {totalNett.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </div>

      {/* TANDA TANGAN */}
      <div className="grid grid-cols-2 gap-8 text-center text-xs mt-8 pt-4 border-t border-gray-300">
        <div>
          <p className="text-gray-600 mb-12">Pihak Kedua (Penyewa)</p>
          <p className="font-bold underline text-gray-900">{contract?.pihak_kedua_nama || 'Ridzat Ali Murphi'}</p>
        </div>
        <div>
          <p className="text-gray-600 mb-12">Pihak Pertama (Pemilik Alat)</p>
          <p className="font-bold underline text-gray-900">{invoice.nama_ttd || contract?.pihak_pertama_nama || 'Novid Chandra'}</p>
        </div>
      </div>

      {/* HALAMAN LAMPIRAN TIMESHEET (REKAP HARIAN) - DI HALAMAN KE DUA */}
      <div 
        className="page-break-before break-before-page print:break-before-page mt-12 pt-6 border-t-2 border-dashed border-gray-400"
        style={{ pageBreakBefore: 'always', breakBefore: 'page' }}
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold text-sm uppercase text-gray-900">LAMPIRAN REKAPITULASI TIMESHEET HARIAN</h3>
            <p className="text-xs text-gray-600">Lampiran Invoice No: {invoice.nomor_invoice} | Kontrak: {contract?.nomor_kontrak || '-'}</p>
          </div>
          <div className="text-right text-xs">
            <span className="font-semibold bg-gray-100 px-2 py-1 rounded border">Total: {totalHari} Hari</span>
          </div>
        </div>

        <table className="w-full text-xs border-collapse border border-gray-300 mb-4">
          <thead>
            <tr className="bg-gray-100 text-gray-800 uppercase font-bold text-[10px] text-center border-b border-gray-300">
              <th className="p-2 border-r border-gray-300 w-8">No</th>
              <th className="p-2 border-r border-gray-300 w-24">Tanggal</th>
              <th className="p-2 border-r border-gray-300 w-24">Nopol Unit</th>
              <th className="p-2 border-r border-gray-300 text-left">Lokasi Pemakaian / STA</th>
              <th className="p-2 border-r border-gray-300 text-left">Kegiatan Pekerjaan</th>
              <th className="p-2 border-r border-gray-300 w-20">Status</th>
              <th className="p-2 border-r border-gray-300 w-16">Hari</th>
              <th className="p-2 text-left">Pengawas / Operator</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedTs.map((ts, idx) => (
              <tr key={ts.id || idx} className="hover:bg-gray-50">
                <td className="p-2 border-r border-gray-300 text-center font-medium">{idx + 1}</td>
                <td className="p-2 border-r border-gray-300 text-center font-medium">
                  {format(new Date(ts.tanggal), 'dd/MM/yyyy')}
                </td>
                <td className="p-2 border-r border-gray-300 font-mono font-bold text-center">{ts.plat_nomor}</td>
                <td className="p-2 border-r border-gray-300 font-medium text-emerald-800">{ts.lokasi_detail}</td>
                <td className="p-2 border-r border-gray-300">{ts.kegiatan || '-'}</td>
                <td className="p-2 border-r border-gray-300 text-center uppercase font-semibold text-[10px]">
                  {ts.status_kerja}
                </td>
                <td className="p-2 border-r border-gray-300 text-center font-bold">{ts.jumlah_hari}</td>
                <td className="p-2 text-[10px]">
                  {ts.pengawas_nama && <div>Spv: {ts.pengawas_nama}</div>}
                  {ts.operator_nama && <div className="text-gray-500">Op: {ts.operator_nama}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* FOTO FOTO TIMESHEET LAPANGAN */}
        {includePhotos && sortedTs.some(t => t.bukti_timesheet) && (
          <div className="mt-6 pt-4 border-t border-gray-300">
            <h4 className="font-bold text-xs uppercase mb-3 text-gray-800">BUKTI FOTO TIMESHEET LAPANGAN</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {sortedTs.filter(t => t.bukti_timesheet).map((t, i) => (
                <div key={i} className="border border-gray-300 p-2 rounded bg-white">
                  <img 
                    src={t.bukti_timesheet} 
                    alt={`Timesheet ${t.plat_nomor}`} 
                    className="w-full h-36 object-contain rounded bg-gray-50 mb-2" 
                  />
                  <div className="text-[10px] text-gray-700">
                    <p className="font-bold">{t.plat_nomor} - {format(new Date(t.tanggal), 'dd/MM/yyyy')}</p>
                    <p className="text-emerald-700 font-medium">{t.lokasi_detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
