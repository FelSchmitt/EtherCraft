'use client'

import { useState } from "react"
import ProfileContent from "./profile"
import ProfileDecks from "./decks"
import { CardData, DeckData } from "../types"
import MatchMenu from "./match"

export default function UserSpace() {
  const [menuIndex, setIndex] = useState(0)

  const nickname = localStorage.getItem('nickname') as string
  const id = localStorage.getItem('id') as string
  const cards: CardData[] = JSON.parse(localStorage.getItem('cards') as string)
  const decks: DeckData[] = JSON.parse(localStorage.getItem('decks') as string)

  let menus = [
    <ProfileContent nickname={nickname} id={id} />,
    <ProfileDecks cards={cards} decks={decks} />,
    <MatchMenu />
  ]

  return (
    <main className="bg-[url(/images/userspace.png)] bg-center bg-no-repeat bg-cover w-full h-full flex flex-col justify-center items-center">
      <section id="side-menu" className="closed w-full h-[20%] bottom-[80%] fixed flex justify-evenly flex-col items-center bg-(--darkgray) border-(--gold) border-b-15 duration-300 md:w-[20%] md:h-full md:self-start md:border-b-0 md:border-r-15 md:bottom-0 md:right-[80%]">
        <button id="side-menu-button" onClick={(event) => { event.currentTarget.parentElement?.classList.toggle('closed') }}
          className="bg-(--gray) w-15 h-15 rounded-[20px] border-(--gold) border-6 absolute md:left-[93%] md:top-[45%] text-3xl duration-500 transition-all">⬅
        </button>
        <button onClick={() => { setIndex(0) }} className="menu-option">Profile</button>
        <button onClick={() => { setIndex(1) }} className="menu-option">Your Decks</button>
        <button onClick={() => { setIndex(2) }} className="menu-option">Match</button>
      </section>

      <section className="bg-(--gray) w-[90%] h-[50%] border-(--gold) border-4 rounded-[15px] md:w-[60%] md:h-[70%] md:left-[5] flex flex-wrap justify-center items-center overflow-y-auto p-4">
        {menus[menuIndex]}
      </section>
    </main>
  )
}