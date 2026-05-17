export function ObjectVectorsMenu() {
    return (
        <div id='object-positions-display' className='absolute w-[18vw] min-h-[15vh] border-2 border-zinc-700 bg-[#aaa] flex justify-evenly flex-col p-1 left-[80%] items-center'>
            <p className='text-center'>POSITION</p>
            <div className='text-black'>
                <span className='mr-2 font-bold'>X</span>
                <input type="number" id="position-x" data-value="x" data-vector="position" className='vectorinput border-black border-2 bg-white' />
            </div>

            <div className='text-black'>
                <span className='mr-2 font-bold'>Y</span>
                <input type="number" id="position-y" data-value="y" data-vector="position" className='vectorinput border-black border-2 bg-white' />
            </div>

            <div className='text-black'>
                <span className='mr-2 font-bold'>Z</span>
                <input type="number" id="position-z" data-value="z" data-vector="position" className='vectorinput border-black border-2 bg-white' />
            </div>

            <p className='text-center'>ROTATION</p>
            <div className='text-black'>
                <span className='mr-2 font-bold'>X</span>
                <input type="number" id="rotation-x" data-value="x" data-vector="rotation" className='vectorinput border-black border-2 bg-white' />
            </div>

            <div className='text-black'>
                <span className='mr-2 font-bold'>Y</span>
                <input type="number" id="rotation-y" data-value="y" data-vector="rotation" className='vectorinput border-black border-2 bg-white' />
            </div>

            <div className='text-black'>
                <span className='mr-2 font-bold'>Z</span>
                <input type="number" id="rotation-z" data-value="z" data-vector="rotation" className='vectorinput border-black border-2 bg-white' />
            </div>

            <button id="get-object-vectors" className='text-sm border-black border-2 rounded-2xl mt-6 bg-amber-400 cursor-pointer'>Get Values of Selected Object</button>
        </div>
    )
}