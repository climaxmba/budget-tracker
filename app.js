(() => {
  const pubSub = (function () {
    let events = {};

    function subscribe(event, fn) {
      events[event] ? events[event].push(fn) : (events[event] = [fn]);
    }
    function unSubscribe(event, fn) {
      if (events[event]) {
        events[event] = events[event].filter((func) => func !== fn);
      }
    }
    function publish(event, data) {
      if (events[event]) events[event].forEach((fn) => fn(data));
    }

    return { subscribe, unSubscribe, publish };
  })();

  const events = {
    newTransactionSubmitted: "newTransactionSubmitted",
    transactionsChanged: "transactionsChanged",
    editTransactionDataRecieved: "editTransactionDataRecieved",
    editTransactionDataRequested: "editTransactionDataRequested",
    transactionEditRequested: "transactionEditRequested",
    transactionDeleteRequested: "transactionDeleteRequested",
  };

  const transaction = (() => {
    let transactions = [];

    function init() {
      pubSub.subscribe(events.newTransactionSubmitted, _addTransaction);
      pubSub.subscribe(
        events.editTransactionDataRequested,
        _sendTransactionData
      );
      pubSub.subscribe(events.transactionDeleteRequested, _deleteTransaction);
      pubSub.subscribe(events.transactionEditRequested, _editTransaction);
    }

    function _addTransaction(data) {
      transactions.push({ ...data, id: _getRandomId() });
      pubSub.publish(events.transactionsChanged, transactions);
    }

    function _getRandomId() {
      const id = Math.floor(Math.random() * 10000000).toString(16);

      // Recursively try to generate a unique random id
      if (transactions.every((transaction) => transaction.id !== id)) return id;
      else return _getRandomId();
    }

    function _sendTransactionData(id) {
      pubSub.publish(
        events.editTransactionDataRecieved,
        transactions.filter((transaction) => transaction.id === id)[0]
      );
    }

    function _deleteTransaction(id) {
      transactions = transactions.filter(
        (transaction) => transaction.id !== id
      );
      pubSub.publish(events.transactionsChanged, transactions);
    }

    function _editTransaction({ id, data }) {
      transactions = transactions.map((transaction) =>
        transaction.id === id ? { ...data, id } : transaction
      );
      pubSub.publish(events.transactionsChanged, transactions);
    }

    return { init };
  })();

  const display = (() => {
    const dom = {
      totalIncome: document.querySelector("[data-js-id='totalIncome']"),
      totalExpense: document.querySelector("[data-js-id='totalExpense']"),
      balance: document.querySelector("[data-js-id='balance']"),
      addTransactionButton: document.querySelector(
        "[data-js-id='addTransactionButton']"
      ),
      transactionList: document.querySelector("[data-js-id='transactionList']"),
      dialog: document.querySelector("[data-js-id='dialog']"),
      modalTitle: document.querySelector("[data-js-id='modalTitle']"),
      modalForm: document.querySelector("[data-js-id='modalForm']"),
      closeModalButton: document.querySelector(
        "[data-js-id='closeModalButton']"
      ),
    };

    function init() {
      pubSub.subscribe(events.transactionsChanged, (data) => {
        _refreshTransactionList(data);
        _updateStats(data);
      });
      pubSub.subscribe(
        events.editTransactionDataRecieved,
        _openEditTransactionModal
      );

      dom.addTransactionButton.addEventListener(
        "click",
        _openNewTransactionModal
      );
      dom.closeModalButton.addEventListener("click", _closeModal);
      dom.dialog.addEventListener(
        "click",
        (e) => e.target === e.currentTarget && _closeModal()
      );
      dom.transactionList.addEventListener("click", _handleTransactionAction);
    }

    function _openNewTransactionModal() {
      dom.modalTitle.textContent = "New Transaction";
      dom.modalForm.innerHTML = `
          <div class="field">
            <label for="input-description">Description:</label>
            <input id="input-description" name="description" type="text" required placeholder="Example: Shoes">
          </div>

          <div class="field">
            <label for="input-ammount">Amount:</label>
            <input id="input-ammount" name="amount" type="number" required>
          </div>

          <div>
            <h2>Transaction type</h2>

            <input id="input-expense" name="type" type="radio" value="expense" checked>
            <label for="input-expense">Expense</label>

            <input id="input-income" name="type" type="radio" value="income">
            <label for="input-income">Income</label>
          </div>

          <button data-js-id="formSubmitButton" type="submit">Add</button>
      `;
      dom.modalForm.onsubmit = (e) => {
        const data = Object.fromEntries(new FormData(e.target));

        pubSub.publish(events.newTransactionSubmitted, {
          ...data,
          amount: parseFloat(data.amount),
        });
        _closeModal();

        e.preventDefault();
      };

      dom.dialog.setAttribute("open", true);
    }

    function _closeModal() {
      dom.dialog.close();
    }

    function _openEditTransactionModal({ description, amount, type, id }) {
      dom.modalTitle.textContent = "Edit Transaction";
      dom.modalForm.innerHTML = `
          <div class="field">
            <label for="input-description">Description:</label>
            <input id="input-description" name="description" type="text" placeholder="Example: Shoes" value="${description}" required>
          </div>

          <div class="field">
            <label for="input-ammount">Amount:</label>
            <input id="input-ammount" name="amount" type="number" value="${amount}" required>
          </div>

          <div>
            <h2>Transaction type</h2>

            <input id="input-expense" name="type" type="radio" value="expense" ${
              type === "expense" ? "checked" : ""
            }>
            <label for="input-expense">Expense</label>

            <input id="input-income" name="type" type="radio" value="income" ${
              type === "income" ? "checked" : ""
            }>
            <label for="input-income">Income</label>
          </div>

          <button data-js-id="formSubmitButton" type="submit">Save Changes</button>
      `;
      dom.modalForm.onsubmit = (e) => {
        const data = Object.fromEntries(new FormData(e.target));

        pubSub.publish(events.transactionEditRequested, {
          id,
          data: { ...data, amount: parseFloat(data.amount) },
        });
        _closeModal();

        e.preventDefault();
      };

      dom.dialog.setAttribute("open", true);
    }

    function _refreshTransactionList(transactions) {
      dom.transactionList.innerHTML = transactions.length
        ? ""
        : `<span id="no-transactions">Oops! No transaction here, click the "Add new" button to create one.</span>`;

      transactions.forEach((transaction) => {
        const node = document.createElement("li");
        node.className = "transaction-item";
        node.innerHTML = `
          <div>
            <p class="price">${
              transaction.type === "income" ? "+" : "-"
            } $${transaction.amount.toLocaleString()}</p>
            <p class="description">${transaction.description}</p>
          </div>
          <div>
            <button data-transaction-id="${
              transaction.id
            }" data-transaction-action="edit" class="icon-btn" type="button" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M14.06,9L15,9.94L5.92,19H5V18.08L14.06,9M17.66,3C17.41,3 17.15,3.1 16.96,3.29L15.13,5.12L18.88,8.87L20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18.17,3.09 17.92,3 17.66,3M14.06,6.19L3,17.25V21H6.75L17.81,9.94L14.06,6.19Z" />
              </svg>
            </button>
            <button data-transaction-id="${
              transaction.id
            }" data-transaction-action="delete" class="icon-btn" type="button" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M9,3V4H4V6H5V19A2,2 0 0,0 7,21H17A2,2 0 0,0 19,19V6H20V4H15V3H9M7,6H17V19H7V6M9,8V17H11V8H9M13,8V17H15V8H13Z" />
              </svg>
            </button>
          </div>`;
        dom.transactionList.appendChild(node);
      });
    }

    function _updateStats(transactions) {
      const income = transactions.reduce(
        (total, transaction) =>
          transaction.type === "income" ? total + transaction.amount : total,
        0
      );
      const expense = transactions.reduce(
        (total, transaction) =>
          transaction.type === "expense" ? total + transaction.amount : total,
        0
      );
      const balance = transactions.reduce(
        (total, transaction) =>
          transaction.type === "income"
            ? total + transaction.amount
            : total - transaction.amount,
        0
      );

      dom.totalIncome.textContent = `$${income.toLocaleString()}`;
      dom.totalExpense.textContent = `$${expense.toLocaleString()}`;
      dom.balance.textContent =
        balance >= 0
          ? `$${balance.toLocaleString()}`
          : `- $${Math.abs(balance).toLocaleString()}`;
    }

    function _handleTransactionAction(e) {
      const elem = e.target;
      const action = elem.getAttribute("data-transaction-action");
      const id = elem.getAttribute("data-transaction-id");
      if (action && id) {
        pubSub.publish(
          action === "edit"
            ? events.editTransactionDataRequested
            : events.transactionDeleteRequested,
          id
        );
      }
    }

    return { init };
  })();

  transaction.init();
  display.init();
})();
