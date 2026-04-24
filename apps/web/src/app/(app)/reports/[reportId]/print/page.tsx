type Props = {
  params: Promise<{ reportId: string }>;
};

export default async function PrintReportPage({ params }: Props) {
  const { reportId } = await params;

  return (
    <main className="bg-white p-8 print:p-0">
      <div className="mx-auto max-w-[210mm]">
        <p className="text-sm text-gray-500">
          Print template for report {reportId} will be implemented in Wave 6.
        </p>
      </div>
    </main>
  );
}
