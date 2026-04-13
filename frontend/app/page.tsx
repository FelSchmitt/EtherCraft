import Link from "next/link"

export default function Home() {
  return (
    <main className="bg-[url(/images/home-background.png)] bg-cover w-full h-full flex justify-center items-center">
      <div className="flex flex-col justify-center items-center">
        <h1 className="font-['thecenturion'] text-(--gold) text-[22vw] text-shadow-[-8px_8px_4px_#0009] md:text-[9vw]">EtherCraft</h1>
        <div className="flex">
          <Link href="/login" className="border-(--gold) border-4 rounded-[7px] bg-(--gray) text-white p-2 text-[20px] font-bold transition-all duration-300 hover:bg-(--goldgray)">ENTRE</Link>
          <p className="text-white text-[40px] font-['cloisterblack'] mx-5">ou</p>
          <Link href="/login/register" className="border-(--gold) border-4 rounded-[7px] bg-(--gray) text-white p-2 text-[20px] font-bold transition-all duration-300 hover:bg-(--goldgray)">CADASTRE-SE</Link>
        </div>
      </div>
    </main>
  )
}