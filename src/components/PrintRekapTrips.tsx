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
}

export default function PrintRekapTrips({
  trips,
  proyeks,
  lokasiProyeks,
  proyekLokasis,
  lokasiKuaris,

  showRingkasanKuari = true,
  hargaMaterialMap = {}
}: PrintRekapTripsProps) {

  // Group by Proyek
  const groupedByProyek = trips.reduce((acc, trip) => {
    const pl = proyekLokasis.find(x => x.id === trip.proyek_lokasi_id);
    const pId = pl ? pl.proyek_id : 0;
    const p = proyeks.find(x => x.id === pId);
    const namaProyek = p ? p.nama_proyek.toUpperCase() : 'TIDAK DIKETAHUI';
    
    if (!acc[namaProyek]) acc[namaProyek] = [];
    acc[namaProyek].push(trip);
    return acc;
  }, {} as Record<string, Trip[]>);

  const getLokasiName = (plId: number) => {
    const pl = proyekLokasis.find(x => x.id === plId);
    if (!pl) return '-';
    const loc = lokasiProyeks.find(x => x.id === pl.lokasi_proyek_id);
    return loc ? loc.nama_lokasi : '-';
  };

  const getKuariName = (kId: number) => {
    const k = lokasiKuaris.find(x => x.id === kId);
    return k ? k.nama_lokasi : '-';
  };

  return (
    <div className="hidden print:block printable-invoice text-[12px] p-0" style={{ boxShadow: 'none' }}>
      {Object.entries(groupedByProyek).map(([namaProyek, tripsProyek], projIdx, projArr) => {
        
        const dates = tripsProyek.map(t => new Date(t.tanggal_bongkar).getTime());
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        
        let dateStr = format(minDate, 'dd MMMM yyyy', { locale: id });
        if (minDate.getTime() !== maxDate.getTime()) {
          dateStr = `${format(minDate, 'dd MMMM yyyy', { locale: id })} s/d ${format(maxDate, 'dd MMMM yyyy', { locale: id })}`;
        }

        // Group by Date
        const groupedByDate = tripsProyek.reduce((acc, t) => {
          const d = format(new Date(t.tanggal_bongkar), 'yyyy-MM-dd');
          if (!acc[d]) acc[d] = [];
          acc[d].push(t);
          return acc;
        }, {} as Record<string, Trip[]>);

        // Group by Kuari
        const rekapanKuari = tripsProyek.reduce((acc, t) => {
          const key = `${t.lokasi_kuari_id}|${getKuariName(t.lokasi_kuari_id)}|${getLokasiName(t.proyek_lokasi_id)}`;
          if (!acc[key]) acc[key] = [];
          acc[key].push(t);
          return acc;
        }, {} as Record<string, Trip[]>);

        return (
          <div key={namaProyek} style={projIdx !== projArr.length - 1 ? { pageBreakAfter: 'always' } : {}}>
            <div className="text-center mb-5">
              <h3 className="text-[18px] font-bold mb-1">Laporan Rekapitulasi Trip</h3>
              <p className="font-bold text-[15px] mb-0">Proyek: {namaProyek}</p>
              <p className="text-[14px] mb-0">Periode Bongkar: {dateStr}</p>
            </div>

            {/* RINGKASAN PER TANGGAL */}
            <div className="mb-5">
              <p className="font-bold text-[14px] mb-2">Ringkasan Per Tanggal:</p>
              <table className="table-bordered w-full">
                <thead className="bg-[#f8f9fa]">
                  <tr>
                    <th className="text-center">Tanggal Bongkar</th>
                    <th className="text-center">Jumlah Rit</th>
                    <th className="text-center">Volume (m³)</th>
                    <th className="text-center">Total Harga (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedByDate).sort(([a], [b]) => a.localeCompare(b)).map(([tgl, harian]) => (
                    <tr key={tgl}>
                      <td className="text-center">{format(new Date(tgl), 'dd/MM/yyyy')}</td>
                      <td className="text-center">{harian.length} Rit</td>
                      <td className="text-center">{harian.reduce((s, t) => s + t.volume, 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="text-right pr-2">Rp {harian.reduce((s, t) => s + t.total_harga, 0).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#f8f9fa] font-bold">
                    <th className="text-right pr-2">TOTAL KESELURUHAN:</th>
                    <th className="text-center">{tripsProyek.length} Rit</th>
                    <th className="text-center">{tripsProyek.reduce((s, t) => s + t.volume, 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</th>
                    <th className="text-right pr-2">Rp {tripsProyek.reduce((s, t) => s + t.total_harga, 0).toLocaleString('id-ID')}</th>
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
                      <th className="text-center">Harga Material / Trip</th>
                      <th className="text-center">Jumlah Rit</th>
                      <th className="text-center">Total Volume</th>
                      <th className="text-center">Total Harga Material</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(rekapanKuari).map(([key, grup]) => {
                      const parts = key.split('|');
                      const kId = Number(parts[0]);
                      const kuari = parts[1];
                      const bongkar = parts[2];
                      
                      const hrgMat = hargaMaterialMap[kId] || 0;
                      const materialCost = hrgMat * grup.length;
                      
                      return (
                        <tr key={key}>
                          <td className="pl-2">{kuari}</td>
                          <td className="pl-2">{bongkar}</td>
                          <td className="text-right pr-2">Rp {hrgMat.toLocaleString('id-ID')}</td>
                          <td className="text-center">{grup.length} Rit</td>
                          <td className="text-center">{grup.reduce((s, x) => s + x.volume, 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="text-right pr-2">Rp {materialCost.toLocaleString('id-ID')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#f8f9fa] font-bold">
                      <th colSpan={3} className="text-right pr-2">TOTAL:</th>
                      <th className="text-center">{tripsProyek.length} Rit</th>
                      <th className="text-center">{tripsProyek.reduce((s, t) => s + t.volume, 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</th>
                      <th className="text-right pr-2">
                        Rp {Object.entries(rekapanKuari).reduce((sum, [key, grup]) => {
                          const kId = Number(key.split('|')[0]);
                          return sum + ((hargaMaterialMap[kId] || 0) * grup.length);
                        }, 0).toLocaleString('id-ID')}
                      </th>
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

            {/* RINCIAN TRIP PER TANGGAL */}
            {Object.entries(groupedByDate).sort(([a], [b]) => a.localeCompare(b)).map(([tgl, harian]) => (
              <div key={tgl} style={{ pageBreakBefore: 'always', marginBottom: '20px' }}>
                <div className="text-center mb-4 pt-4">
                  <h3 className="text-[18px] font-bold mb-1">Rincian Trip Per Tanggal</h3>
                  <p className="font-bold text-[15px] mb-0">Proyek: {namaProyek}</p>
                  <p className="font-bold text-[15px] mb-0">Tanggal Bongkar: {format(new Date(tgl), 'dd MMMM yyyy', { locale: id })}</p>
                </div>
                
                <table className="table-bordered w-full">
                  <thead className="bg-[#f8f9fa]">
                    <tr>
                      <th className="w-[5%] text-center">No</th>
                      <th className="w-[15%] text-center">Tgl Muat</th>
                      <th className="w-[20%] text-center">Lokasi Bongkar</th>
                      <th className="w-[20%] text-center">Tempat Muat (Kuari)</th>
                      <th className="w-[15%] text-center">Plat Nomor</th>
                      <th className="w-[10%] text-center">Volume</th>
                      <th className="w-[15%] text-center">Total (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {harian.map((trip, idx) => (
                      <tr key={trip.id}>
                        <td className="text-center">{idx + 1}</td>
                        <td className="text-center">{format(new Date(trip.tanggal_muat), 'dd/MM/yyyy')}</td>
                        <td className="text-center">{getLokasiName(trip.proyek_lokasi_id)}</td>
                        <td className="text-center">{getKuariName(trip.lokasi_kuari_id)}</td>
                        <td className="text-center font-bold">{trip.plat_nomor}</td>
                        <td className="text-center">{trip.volume.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right pr-2">{trip.total_harga.toLocaleString('id-ID')}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#f8f9fa] font-bold">
                      <th colSpan={5} className="text-right pr-2">SUBTOTAL TANGGAL {format(new Date(tgl), 'dd/MM/yyyy')}:</th>
                      <th className="text-center">{harian.reduce((s, x) => s + x.volume, 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</th>
                      <th className="text-right pr-2">{harian.reduce((s, x) => s + x.total_harga, 0).toLocaleString('id-ID')}</th>
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
