import { _decorator, Component, Node, UITransform, Vec3, sp } from 'cc';

const { ccclass, property } = _decorator;

interface FishBounds {
    centerX: number;
    bottom: number;
}

interface FishState {
    delay: number;
    elapsed: number;
    laneX: number;
    startY: number;
    targetY: number;
    dropDuration: number;
    swingAmplitude: number;
    swingCycles: number;
    floatAmplitude: number;
    floatCyclesPerDuration: number;
    started: boolean;
    landed: boolean;
}

interface BgDropState {
    index: number;
    elapsed: number;
    laneIndex: number;
    laneX: number;
    startY: number;
    endY: number;
    duration: number;
    swingAmplitude: number;
    swingCycles: number;
}

const FISH_BOUNDS: FishBounds[] = [
    { centerX: -516.13, bottom: -287.85 },
    { centerX: -201.35, bottom: -286.66 },
    { centerX: 110.52, bottom: -289.54 },
    { centerX: 434.34, bottom: -289.38 },
];

const LANES = [-480, -160, 160, 480];
const DROP_ANIMATION = '1_zhangzui';
const IDLE_ANIMATION = '2_daiji';

const SHAPE_CATEGORIES = {
    triangle: ['yu4', 'bg2', 'bg4', 'bg6', 'bg11', 'bg14', 'bg18', 'bg19', 'bg20', 'bg21', 'bg22'],
    circle: ['yu1', 'bg9', 'bg12', 'bg15'],
    square: ['yu3', 'bg5', 'bg8', 'bg17'],
    rectangle: ['yu2', 'bg1', 'bg3', 'bg7', 'bg10', 'bg13', 'bg16'],
};

@ccclass('GameStart')
export class GameStart extends Component {
    @property({ type: [Node] })
    public fishes: Node[] = [];

    @property({ type: [Node] })
    public bgNodes: Node[] = [];

    @property
    public bottomPadding = 20;

    @property
    public startOffset = 120;

    @property
    public minStartInterval = 0.3;

    @property
    public maxStartInterval = 0.6;

    @property
    public fishScale = 0.8;

    @property
    public minDropDuration = 3;

    @property
    public maxDropDuration = 6;

    @property
    public minSwingAmplitude = 5;

    @property
    public maxSwingAmplitude = 30;

    @property
    public minSwingCycles = 3;

    @property
    public maxSwingCycles = 6;

    @property
    public minFloatAmplitude = 5;

    @property
    public maxFloatAmplitude = 20;

    @property
    public minFloatCyclesPerDuration = 2;

    @property
    public maxFloatCyclesPerDuration = 3;

    @property
    public bgDropStartDelay = 1;

    @property
    public bgDropSpeed = 60;

    @property
    public bgSpawnAfterEnterDelay = 1;

    @property
    public bgSameLaneMinCenterGap = 260;

    @property
    public bgSameLaneSpawnInterval = 5;

    @property
    public minBgSwingAmplitude = 15;

    @property
    public maxBgSwingAmplitude = 30;

    @property
    public minBgSwingCycles = 3;

    @property
    public maxBgSwingCycles = 6;

    private states: FishState[] = [];
    private bgStartElapsed = 0;
    private bgStageStarted = false;
    private bgRoundOrder: number[] = [];
    private bgRoundCursor = 0;
    private activeBgStates: BgDropState[] = [];
    private bgLaneCooldowns: number[] = [];
    private bgSpawnElapsed = 0;
    private nextBgSpawnDelay = 0;

    start() {
        this.playOpeningDrop();
    }

    update(deltaTime: number) {
        this.fishes.forEach((fish, index) => {
            const state = this.states[index];
            if (!fish || !state) {
                return;
            }

            state.elapsed += deltaTime;
            const activeElapsed = state.elapsed - state.delay;

            if (activeElapsed < 0) {
                return;
            }

            if (!state.started) {
                state.started = true;
                this.playAnimation(fish, DROP_ANIMATION, true);
            }

            if (activeElapsed < state.dropDuration) {
                const progress = activeElapsed / state.dropDuration;
                const swing = Math.sin(progress * Math.PI * 2 * state.swingCycles) * state.swingAmplitude;
                const y = state.startY + (state.targetY - state.startY) * progress;
                fish.setPosition(new Vec3(state.laneX + swing, y, 0));
                return;
            }

            if (!state.landed) {
                state.landed = true;
                fish.setPosition(new Vec3(state.laneX, state.targetY, 0));
                this.playAnimation(fish, IDLE_ANIMATION, true);
                return;
            }

            const floatElapsed = activeElapsed - state.dropDuration;
            const floatRate = state.floatCyclesPerDuration / 3;
            const floatY = Math.sin(floatElapsed * Math.PI * 2 * floatRate) * state.floatAmplitude;
            fish.setPosition(new Vec3(state.laneX, state.targetY + floatY, 0));
        });

        this.updateBgDropStage(deltaTime);
    }

    private playOpeningDrop() {
        const canvasTransform = this.node.getComponent(UITransform);
        const height = canvasTransform?.height ?? 720;
        const order = this.createRandomOrder(this.fishes.length);
        const delays = this.createStartDelays(order);
        this.states = [];

        this.fishes.forEach((fish, index) => {
            if (!fish) {
                return;
            }

            const bounds = FISH_BOUNDS[index] ?? { centerX: 0, bottom: 0 };
            const laneCenterX = LANES[index] ?? 0;
            const scaledCenterX = bounds.centerX * this.fishScale;
            const scaledBottom = bounds.bottom * this.fishScale;
            const laneX = laneCenterX - scaledCenterX;
            const startY = height / 2 + this.startOffset - scaledBottom;
            const targetY = -height / 2 + this.bottomPadding - scaledBottom;
            const orderIndex = order.indexOf(index);
            const dropDuration = this.randomRange(this.minDropDuration, this.maxDropDuration);

            fish.setScale(new Vec3(this.fishScale, this.fishScale, 1));
            fish.setPosition(new Vec3(laneX, startY, 0));

            this.states[index] = {
                delay: delays[orderIndex] ?? 0,
                elapsed: 0,
                laneX,
                startY,
                targetY,
                dropDuration,
                swingAmplitude: this.randomRange(this.minSwingAmplitude, this.maxSwingAmplitude),
                swingCycles: this.randomIntInclusive(this.minSwingCycles, this.maxSwingCycles),
                floatAmplitude: this.randomRange(this.minFloatAmplitude, this.maxFloatAmplitude),
                floatCyclesPerDuration: this.randomRange(this.minFloatCyclesPerDuration, this.maxFloatCyclesPerDuration),
                started: false,
                landed: false,
            };
        });

        this.resetBgDropStage();
    }

    private resetBgDropStage() {
        this.bgStartElapsed = 0;
        this.bgStageStarted = false;
        this.bgRoundOrder = [];
        this.bgRoundCursor = 0;
        this.activeBgStates = [];
        this.bgLaneCooldowns = LANES.map(() => 0);
        this.bgSpawnElapsed = 0;
        this.nextBgSpawnDelay = 0;

        this.bgNodes.forEach((bg) => {
            if (!bg) {
                return;
            }

            bg.active = false;
        });
    }

    private updateBgDropStage(deltaTime: number) {
        if (!this.bgStageStarted) {
            if (!this.areAllFishesLanded()) {
                return;
            }

            this.bgStartElapsed += deltaTime;
            if (this.bgStartElapsed < this.bgDropStartDelay) {
                return;
            }

            this.bgStageStarted = true;
            this.spawnNextBgDrop();
        }

        this.updateBgLaneCooldowns(deltaTime);
        this.updateActiveBgs(deltaTime);
        this.updateBgSpawn(deltaTime);
    }

    private areAllFishesLanded(): boolean {
        return this.fishes.length > 0 && this.states.length >= this.fishes.length && this.states.every((state) => state?.landed);
    }

    private updateActiveBgs(deltaTime: number) {
        this.activeBgStates = this.activeBgStates.filter((state) => {
            const bg = this.bgNodes[state.index];
            if (!bg) {
                return false;
            }

            state.elapsed += deltaTime;
            const progress = Math.min(state.elapsed / state.duration, 1);
            const y = state.startY + (state.endY - state.startY) * progress;
            const swing = Math.sin(progress * Math.PI * 2 * state.swingCycles) * state.swingAmplitude;
            bg.setPosition(new Vec3(state.laneX + swing, y, 0));

            if (progress >= 1) {
                bg.active = false;
                return false;
            }

            return true;
        });
    }

    private updateBgSpawn(deltaTime: number) {
        if (!this.bgStageStarted || this.nextBgSpawnDelay <= 0) {
            return;
        }

        this.bgSpawnElapsed += deltaTime;
        if (this.bgSpawnElapsed >= this.nextBgSpawnDelay) {
            this.spawnNextBgDrop();
        }
    }

    private spawnNextBgDrop() {
        if (this.bgNodes.length === 0) {
            return;
        }

        if (this.bgRoundCursor >= this.bgRoundOrder.length) {
            this.bgRoundOrder = this.createRandomOrder(this.bgNodes.length);
            this.bgRoundCursor = 0;
        }

        const bgIndex = this.bgRoundOrder[this.bgRoundCursor];
        this.bgRoundCursor += 1;

        const bg = this.bgNodes[bgIndex];
        if (!bg) {
            this.nextBgSpawnDelay = 0;
            return;
        }

        const canvasTransform = this.node.getComponent(UITransform);
        const height = canvasTransform?.height ?? 720;
        const bgTransform = bg.getComponent(UITransform);
        const bgHeight = bgTransform?.height ?? 0;
        const speed = Math.max(this.bgDropSpeed, 1);
        const startY = height / 2 + bgHeight / 2;
        const laneIndex = this.pickAvailableBgLaneIndex(startY);
        if (laneIndex === null) {
            this.bgRoundCursor -= 1;
            return;
        }

        const laneX = LANES[laneIndex] ?? 0;
        const endY = -height / 2 - bgHeight / 2;
        const duration = Math.abs(startY - endY) / speed;

        bg.active = true;
        bg.setPosition(new Vec3(laneX, startY, 0));

        this.activeBgStates.push({
            index: bgIndex,
            elapsed: 0,
            laneIndex,
            laneX,
            startY,
            endY,
            duration,
            swingAmplitude: this.randomRange(this.minBgSwingAmplitude, this.maxBgSwingAmplitude),
            swingCycles: this.randomIntInclusive(this.minBgSwingCycles, this.maxBgSwingCycles),
        });

        this.bgSpawnElapsed = 0;
        this.nextBgSpawnDelay = bgHeight / speed + this.bgSpawnAfterEnterDelay;
        this.bgLaneCooldowns[laneIndex] = this.bgSameLaneSpawnInterval;
    }

    private updateBgLaneCooldowns(deltaTime: number) {
        this.bgLaneCooldowns = this.bgLaneCooldowns.map((cooldown) => Math.max(cooldown - deltaTime, 0));
    }

    private pickAvailableBgLaneIndex(startY: number): number | null {
        const availableLaneIndexes = LANES.map((_, index) => index).filter((laneIndex) => {
            if ((this.bgLaneCooldowns[laneIndex] ?? 0) > 0) {
                return false;
            }

            return this.activeBgStates.every((state) => {
                if (state.laneIndex !== laneIndex) {
                    return true;
                }

                const bg = this.bgNodes[state.index];
                if (!bg || !bg.active) {
                    return true;
                }

                return Math.abs(bg.position.y - startY) >= this.bgSameLaneMinCenterGap;
            });
        });

        if (availableLaneIndexes.length === 0) {
            return null;
        }

        return availableLaneIndexes[Math.floor(Math.random() * availableLaneIndexes.length)] ?? null;
    }

    private createRandomOrder(length: number): number[] {
        const order = Array.from({ length }, (_, index) => index);
        for (let index = order.length - 1; index > 0; index--) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [order[index], order[randomIndex]] = [order[randomIndex], order[index]];
        }
        return order;
    }

    private createStartDelays(order: number[]): number[] {
        const delays = [0];
        for (let index = 1; index < order.length; index++) {
            const interval = this.randomRange(this.minStartInterval, this.maxStartInterval);
            delays[index] = delays[index - 1] + interval;
        }
        return delays;
    }

    private randomRange(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }

    private randomIntInclusive(min: number, max: number): number {
        const lower = Math.ceil(min);
        const upper = Math.floor(max);
        return Math.floor(this.randomRange(lower, upper + 1));
    }

    private playAnimation(fish: Node, animationName: string, loop: boolean) {
        const skeleton = fish.getComponent(sp.Skeleton);
        if (!skeleton) {
            return;
        }

        skeleton.setAnimation(0, animationName, loop);
    }
}
