import { socketConnection } from "../socket_channels"

export function ServerControlTools() {
    return (
        <div id='test-tools' className='absolute w-[50vw] h-[10vh] border-2 rounded-2xl border-zinc-500 bg-[#8888] flex justify-evenly items-center'>
            <div onClick={() => { (document.getElementById('test-chat') as HTMLDivElement).innerHTML = '' }} className='tools-menu-option'>
                <img src='/icons/clear.png' className='tools-menu-image' />
                <span className='tools-menu-label'>Clear Chat</span>
            </div>

            <div onClick={() => { localStorage.getItem('id') && socketConnection.emit('find_opponent', { id: localStorage.getItem('id'), nickname: localStorage.getItem('nickname') }) }} className='tools-menu-option'>
                <img src='/icons/join.png' className='tools-menu-image' />
                <span className='tools-menu-label'>Join Waiting Queue</span>
            </div>

            <div onClick={() => { socketConnection.emit('clear_waiting_queue', 'message') }} className='tools-menu-option'>
                <img src='/icons/clear.png' className='tools-menu-image' />
                <span className='tools-menu-label'>Clear Waiting Queue</span>
            </div>

            <div onClick={() => { socketConnection.emit('delete_all_matches', 'message') }} className='tools-menu-option'>
                <img src='/icons/delete.png' className='tools-menu-image' />
                <span className='tools-menu-label'>Delete All Matches</span>
            </div>

            <div onClick={() => { socketConnection.emit('get_match', 'message') }} className='tools-menu-option'>
                <img src='/icons/console.png' className='tools-menu-image' />
                <span className='tools-menu-label'>Get Match Data</span>
            </div>

            <div id='reset-scene' className='tools-menu-option'>
                <img src='/icons/reset.png' className='tools-menu-image' />
                <span className='tools-menu-label'>Reset Scene</span>
            </div>

            <span id='loop-label' className='font-bold bg-white p-2 rounded-2xl'>Game Scene Running</span>
        </div>
    )
}