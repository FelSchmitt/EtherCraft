'use client'

import { useRouter } from "next/navigation"
import { FormEvent } from "react"

type accountObject = {
  access: string,
  account_id: string,
  user_nickname: string,
  cards: Object[],
  decks: Object[]
}


export default function LoginPage() {
  const router = useRouter()

  async function sendData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const data = new FormData(event.currentTarget)

    const request = await fetch('http://localhost:3001/login/validatefields', {
      method: 'post',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account_id: data.get('account_id'), password: data.get('password') })
    })

    const response = await request.json()

    const fields: NodeListOf<HTMLDivElement> = document.querySelectorAll('.fielddiv')

    for (const field of fields) {
      field.classList.remove('invalid')
      const span = field.querySelector('span')
      if (span) { span.remove() }
    }

    const texts: string[] = [
      'ID não encontrado. Certifique-se de ter escrito certo',
      'Senha incorreta. Verifique!'
    ]

    if (response.messages) {
      fields[response.messages[0].code].innerHTML += `<span class="w-67.5 md:w-80 text-[15px] text-orange-400">${texts[response.messages[0].code]}</span>`
    }

    else if (response.user_nickname) {
      localStorage.setItem('access', response.access)
      localStorage.setItem('id', response.account_id)
      localStorage.setItem('nickname', response.user_nickname)
      localStorage.setItem('cards', JSON.stringify(response.cards))
      localStorage.setItem('decks', JSON.stringify(response.decks))
      router.push('/userspace')
    }
  }

  return (
    <main className="bg-[url(/images/home-background.png)] bg-cover w-full h-full flex justify-center items-center">
      <form onSubmit={sendData} className="border-(--gold) border-4 rounded-[10px] bg-(--gray) flex flex-col justify-evenly items-center p-3 h-[50vh]">
        <img src="/images/logo.png" width={100} alt="Logo" />
        <div id="account-id" className="fielddiv flex flex-col">
          <input type="text" name="account_id" placeholder="ID ou Email da Conta..." className="bg-white w-67.5 md:w-80 h-7.5" />
        </div>
        <div id="password" className="fielddiv flex flex-col">
          <input type="password" name="password" placeholder="Senha..." className="bg-white w-67.5 md:w-80 h-7.5" />
        </div>
        <button type="submit" className="border-(--gold) border-4 rounded-[7px] bg-(--goldgray) text-white p-2 text-[15px] font-bold transition-all duration-300 hover:bg-(--darkgoldgray) cursor-pointer">ENTRAR</button>
      </form>
    </main>
  )
}