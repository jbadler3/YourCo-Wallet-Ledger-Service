type balanceEntry = {
    userId: string;
    balance: number;
    prev: balanceEntry | null;
    next: balanceEntry | null;
}

export class cache {
    private capacity = 5;
    private map = new Map<string, balanceEntry>();
    private head: balanceEntry = {userId: "", balance: 0, prev: null, next: null};
    private tail: balanceEntry = {userId: "", balance: 0, prev: null, next: null};

    constructor() {
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }

    // get User value, move it to the front of the cache
    getUserBalance(userId: string) {
        let userCurrentNode = this.map.get(userId);

        if (!userCurrentNode) return -1;

        this.moveToFront(userCurrentNode);
        return userCurrentNode.balance;
    }
    //set user value, move it to the front

    setUserBalance(userId: string, balance: number) {
        let currentNode = this.map.get(userId);

        if (currentNode) {
            // node exists, move it to front
            currentNode.balance = balance;
            this.removeNode(currentNode);
            this.moveToFront(currentNode);
            return;
        }

        let newNode: balanceEntry = {userId: userId, balance: balance, prev: null, next: null};
        this.map.set(userId, newNode);
        this.moveToFront(newNode);

        if (this.map.size > this.capacity) {
            let nodeToRemove = this.tail.prev!;
            this.map.delete(nodeToRemove.userId);
            this.removeNode(nodeToRemove);
        }
    }
    // private methods that remove node, and add nodes to front

    private moveToFront(n: balanceEntry) {
        n.prev = this.head;
        n.next = this.head.next;

        this.head.next!.prev = n;
        this.head.next = n;
    }

    private removeNode(n: balanceEntry) {
        n.prev!.next = n.next;
        n.next!.prev = n.prev;

        n.prev = null;
        n.next = null;
    }
}

export const cacheGlobal = new cache();
