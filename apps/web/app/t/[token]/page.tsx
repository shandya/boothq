import type { Metadata } from "next";
import { CustomerScreen } from "../../../components/customer/CustomerScreen";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function CustomerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <CustomerScreen token={token} />;
}
