export default function Closed() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#faf9f7] px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground">This form is closed</h1>
        <p className="mt-2 text-muted-foreground">
          It has reached its submission limit. Thanks for your interest!
        </p>
      </div>
    </main>
  );
}
