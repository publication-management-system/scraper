const randomSleep = async (min: number, max: number) => {
    await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min)) + min));
}

export { randomSleep };