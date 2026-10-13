import IsbnLookup from "./isbn-lookup";

export const dynamic = "force-dynamic";

export default function IsbnPage() {
  return (
    <div className="flex flex-col gap-4">
      <IsbnLookup />
    </div>
  );
}
