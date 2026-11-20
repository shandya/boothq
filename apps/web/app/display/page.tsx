import type { Metadata } from "next";
import { DisplayScreen } from "../../components/display/DisplayScreen";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DisplayPage() {
  return <DisplayScreen />;
}
