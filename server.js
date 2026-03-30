require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 1. Inicialização do Banco de Dados
// ==========================================
const db = new sqlite3.Database('./wishlist.db', (err) => {
    if (err) console.error('Erro ao abrir o banco de dados:', err);
    else console.log('✅ Conectado ao banco de dados SQLite.');
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS wishlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id TEXT,
            customer_id TEXT,
            product_id TEXT,
            product_data TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

// ==========================================
// 2. Rotas do Aplicativo Frontend (Loja)
// ==========================================

// Ler os favoritos de um cliente
app.get('/v1/wishlist', (req, res) => {
    const customer = req.query.customer;
    if (!customer) return res.status(400).json({ error: 'Customer is required' });

    db.all(`SELECT product_data FROM wishlists WHERE customer_id = ?`, [customer], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const items = rows.map(r => JSON.parse(r.product_data));
        res.json(items);
    });
});

// Salvar um favorito
app.post('/v1/wishlist', (req, res) => {
    const { customer_id, product } = req.body;
    if (!customer_id || !product) return res.status(400).json({ error: 'Customer e Product são obrigatórios' });

    const store_id = "test-store"; // Simulando identificador de loja multi-tenant

    db.get(`SELECT id FROM wishlists WHERE customer_id = ? AND product_id = ?`, [customer_id, product.id], (err, row) => {
        if (row) return res.json({ success: true, message: 'Já existe' }); // Não duplica
        
        db.run(`INSERT INTO wishlists (store_id, customer_id, product_id, product_data) VALUES (?, ?, ?, ?)`, 
            [store_id, customer_id, product.id, JSON.stringify(product)], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, internal_id: this.lastID });
        });
    });
});

// Remover um favorito
app.delete('/v1/wishlist', (req, res) => {
    const { customer_id, product_id } = req.body;
    if (!customer_id || !product_id) return res.status(400).json({ error: 'Faltando campos obrigatórios' });

    db.run(`DELETE FROM wishlists WHERE customer_id = ? AND product_id = ?`, [customer_id, product_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, deleted: this.changes });
    });
});

// ==========================================
// 3. Inicialização do Servidor
// ==========================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Gofersi Backend App iniciado com sucesso na porta ${PORT}`);
    console.log(`Para testes, a API responde em: http://localhost:${PORT}/v1`);
});
