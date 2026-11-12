import type { Metadata } from "next";
import { CreateRoomForm } from "./create-room-form";

export const metadata: Metadata = { title: "部屋をつくる" };

export default function NewRoomPage() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold">部屋をつくる</h1>
      <CreateRoomForm />
    </div>
  );
}
