import { format } from "date-fns";
import { id } from "date-fns/locale";
import type { Trip, ProyekLokasi, LokasiProyek, LokasiKuari, Proyek } from "@/lib/db";

interface PrintRekapTripsProps {
  trips: Trip[];
  proyeks: Proyek[];
  lokasiProyeks: LokasiProyek[];
  proyekLokasis: ProyekLokasi[];
  lokasiKuaris: LokasiKuari[];

  showRingkasanKuari?: boolean;
  hargaMaterialMap?: Record<number, number>;
  previewMode?: boolean;
}

export default function PrintRekapTrips({
  trips,
  proyeks,
  lokasiProyeks,
  proyekLokasis,
  lokasiKuaris,

  showRingkasanKuari = true,
  hargaMaterialMap = {},
  previewMode = false
}: PrintRekapTripsProps) {

  const getLokasiName = (plId: number) => {
    const pl = proyekLokasis.find(x => x.id === plId);
    if (!pl) return '-';
    const p = proyeks.find(x => x.id === pl.proyek_id);
    const loc = lokasiProyeks.find(x => x.id === pl.lokasi_proyek_id);
    const pName = p ? p.nama_proyek : '';
    const lName = loc ? loc.nama_lokasi : '';
    return pName ? `${pName} - ${lName}` : lName;
  };

  const getKuariName = (kId: number) => {
    const k = lokasiKuaris.find(x => x.id === kId);
    return k ? k.nama_lokasi : '-';
  };

  if (trips.length === 0) {
    return <div className="p-4 text-center">Tidak ada data trip untuk dicetak.</div>;
  }

  const dates = trips.map(t => new Date(t.tanggal_bongkar).getTime());
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  
  let dateStr = format(minDate, 'dd MMMM yyyy', { locale: id });
  if (minDate.getTime() !== maxDate.getTime()) {
    dateStr = `${format(minDate, 'dd MMMM yyyy', { locale: id })} s/d ${format(maxDate, 'dd MMMM yyyy', { locale: id })}`;
  }

  // 1. Group by Lokasi Bongkaran (Proyek Lokasi ID) for Summary
  const summaryByLokasi = trips.reduce((acc, t) => {
    const plId = t.proyek_lokasi_id;
    if (!acc[plId]) acc[plId] = [];
    acc[plId].push(t);
    return acc;
  }, {} as Record<number, Trip[]>);

  // Group by Kuari (Global)
  const rekapanKuari = trips.reduce((acc, t) => {
    const key = `${t.lokasi_kuari_id}|${getKuariName(t.lokasi_kuari_id)}|${getLokasiName(t.proyek_lokasi_id)}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, Trip[]>);

  return (
    <div className={`${previewMode ? 'bg-white p-8 text-black w-full min-w-[800px]' : 'hidden print:block'} printable-invoice text-[12px] p-0`} style={{ boxShadow: 'none' }}>
      
      {/* PAGE 1: RINGKASAN */}
      <div style={{ pageBreakAfter: 'always' }}>
        <div className="text-center mb-5">
          <h3 className="text-[18px] font-bold mb-1">Laporan Rekapitulasi Trip</h3>
          <p className="text-[14px] mb-0">Periode Bongkar: {dateStr}</p>
        </div>

        {/* RINGKASAN PER LOKASI BONGKAR */}
        <div className="mb-5">
          <p className="font-bold text-[14px] mb-2">Ringkasan Berdasarkan Lokasi Bongkaran:</p>
          <table className="table-bordered w-full">
            <thead className="bg-[#f8f9fa]">
              <tr>
                <th className="text-center w-[5%]">No</th>
                <th className="text-center">Lokasi Bongkar (Proyek - Tujuan)</th>
                <th className="text-center w-[20%]">Jumlah Rit</th>
                <th className="text-center w-[25%]">Volume (m³)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summaryByLokasi).map(([plIdStr, grupLokasi], idx) => (
                <tr key={plIdStr}>
                  <td className="text-center">{idx + 1}</td>
                  <td className="pl-2 font-medium">{getLokasiName(Number(plIdStr))}</td>
                  <td className="text-center">{grupLokasi.length} Rit</td>
                  <td className="text-center">{grupLokasi.reduce((s, t) => s + t.volume, 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#f8f9fa] font-bold">
                <th colSpan={2} className="text-right pr-2">TOTAL KESELURUHAN:</th>
                <th className="text-center">{trips.length} Rit</th>
                <th className="text-center">{trips.reduce((s, t) => s + t.volume, 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</th>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* RINGKASAN TEMPAT MUAT */}
        {showRingkasanKuari && (
          <div className="mb-5" style={{ pageBreakInside: 'avoid' }}>
            <p className="font-bold text-[14px] mb-2">Ringkasan Tempat Muat (Kuari):</p>
            <table className="table-bordered w-full">
              <thead className="bg-[#f8f9fa]">
                <tr>
                  <th className="text-center">Tempat Muat (Kuari)</th>
                  <th className="text-center">Tujuan / Lokasi Bongkar</th>
                  <th className="text-center w-[20%]">Jumlah Rit</th>
                  <th className="text-center w-[25%]">Total Volume</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(rekapanKuari).map(([key, grup]) => {
                  const parts = key.split('|');
                  const kuari = parts[1];
                  const bongkar = parts[2];
                  
                  return (
                    <tr key={key}>
                      <td className="pl-2">{kuari}</td>
                      <td className="pl-2">{bongkar}</td>
                      <td className="text-center">{grup.length} Rit</td>
                      <td className="text-center">{grup.reduce((s, x) => s + x.volume, 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#f8f9fa] font-bold">
                  <th colSpan={2} className="text-right pr-2">TOTAL:</th>
                  <th className="text-center">{trips.length} Rit</th>
                  <th className="text-center">{trips.reduce((s, t) => s + t.volume, 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="mt-8" style={{ pageBreakInside: 'avoid' }}>
          <table className="w-full border-none">
            <tbody>
              <tr>
                <td className="w-1/2 text-center border-none">
                  <p className="mb-20">Pengirim,</p>
                  <p className="font-bold">( ........................................ )</p>
                </td>
                <td className="w-1/2 text-center border-none">
                  <p className="mb-20">Penerima,</p>
                  <p className="font-bold">( ........................................ )</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGE 2+: RINCIAN TRIP PER LOKASI BONGKAR & TANGGAL */}
      {Object.entries(summaryByLokasi).map(([plIdStr, grupLokasi], idxLokasi, arrLokasi) => {
        const lokasiName = getLokasiName(Number(plIdStr));
        
        // Group by Date within this Lokasi
        const groupedByDate = grupLokasi.reduce((acc, t) => {
          const d = format(new Date(t.tanggal_bongkar), 'yyyy-MM-dd');
          if (!acc[d]) acc[d] = [];
          acc[d].push(t);
          return acc;
        }, {} as Record<string, Trip[]>);

        return (
          <div key={plIdStr} style={idxLokasi !== arrLokasi.length - 1 ? { pageBreakAfter: 'always' } : {}}>
            <div className="text-center mb-4 pt-4">
              <h3 className="text-[18px] font-bold mb-1">Rincian Trip - {lokasiName}</h3>
            </div>

            {Object.entries(groupedByDate).sort(([a], [b]) => a.localeCompare(b)).map(([tgl, harian]) => (
              <div key={tgl} style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
                <p className="font-bold text-[14px] mb-2">Tanggal Bongkar: {format(new Date(tgl), 'dd MMMM yyyy', { locale: id })}</p>
                
                <table className="table-bordered w-full">
                  <thead className="bg-[#f8f9fa]">
                    <tr>
                      <th className="w-[5%] text-center">No</th>
                      <th className="w-[20%] text-center">Tgl Muat</th>
                      <th className="w-[30%] text-center">Tempat Muat (Kuari)</th>
                      <th className="w-[25%] text-center">Plat Nomor</th>
                      <th className="w-[20%] text-center">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {harian.map((trip, idx) => (
                      <tr key={trip.id}>
                        <td className="text-center">{idx + 1}</td>
                        <td className="text-center">{format(new Date(trip.tanggal_muat), 'dd/MM/yyyy')}</td>
                        <td className="text-center">{getKuariName(trip.lokasi_kuari_id)}</td>
                        <td className="text-center font-bold">{trip.plat_nomor}</td>
                        <td className="text-center">{trip.volume.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#f8f9fa] font-bold">
                      <th colSpan={4} className="text-right pr-2">SUBTOTAL TANGGAL {format(new Date(tgl), 'dd/MM/yyyy')}:</th>
                      <th className="text-center">{harian.reduce((s, x) => s + x.volume, 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
