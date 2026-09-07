import React, { useState, useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { supabase } from './supabaseClient';

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_TON_ID_PUBLIC_ICI'
);

interface Product {
  id: number;
  nom: string;  
  prix: string | number;
  categorie: string;
  img: string;
  description: string;
}

interface CartItem {
  id: number;
  nom: string;
  prix: number;
  quantity: number;
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  const logoClicksRef = useRef(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [newProduct, setNewProduct] = useState({
    nom: '',
    prix: '',
    categorie: 'Créations florales',
    imgUrl: '',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur chargement produits:', error);
    } else if (data) {
      setProducts(data);
    }
  };

  const handleLogoClick = () => {
    logoClicksRef.current += 1;
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => { logoClicksRef.current = 0; }, 600);

    if (logoClicksRef.current === 3) {
      logoClicksRef.current = 0;
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);

      if (!isAdminOpen) {
        const pwd = prompt('Entrez le mot de passe admin :');
        if (pwd === 'admin123') setIsAdminOpen(true);
        else if (pwd !== null) alert('Mot de passe incorrect !');
      } else {
        setIsAdminOpen(false);
      }
    }
  };

  const addToCart = (product: Product) => {
    const numericPrice = typeof product.prix === 'string' ? parseFloat(product.prix) : product.prix;

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { id: product.id, nom: product.nom, prix: numericPrice, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.prix * item.quantity, 0);
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.nom.trim() || !newProduct.prix.trim()) {
      return alert('Merci de renseigner un nom et un prix.');
    }

    const itemToInsert = {
      nom: newProduct.nom.trim(),
      prix: parseFloat(newProduct.prix).toFixed(2),
      categorie: newProduct.categorie,
      img: newProduct.imgUrl || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500',
      description: 'Création artisanale de L’atelier aux mille trésors.',
    };

    const { error } = await supabase.from('products').insert([itemToInsert]);

    if (error) {
      alert("Erreur lors de l'enregistrement du produit.");
    } else {
      alert('Produit ajouté avec succès !');
      setNewProduct({ nom: '', prix: '', categorie: 'Créations florales', imgUrl: '' });
      fetchProducts();
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Voulez-vous vraiment supprimer ce produit ?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) fetchProducts();
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartItems: cart.map((item) => ({ name: item.nom, price: item.prix, quantity: item.quantity })),
        }),
      });
      const session = await response.json();
      if (session.url) window.location.href = session.url;
      else alert('Erreur: ' + (session.error || 'URL introuvable'));
    } catch (error) {
      alert('Erreur lors de la redirection vers le paiement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#3c2820] font-sans pb-16 relative">
      <header className="py-4 px-6 bg-white border-b border-[#e7dfe3] sticky top-0 z-20 flex justify-between items-center shadow-sm">
        <div onClick={handleLogoClick} className="flex items-center space-x-3 cursor-pointer select-none">
          <img 
            src="/logo.png" 
            alt="Logo" 
            className="w-10 h-10 object-contain rounded-full border border-[#e7dfe3]"
            onError={(e)=>{ (e.target as HTMLElement).style.display = 'none'; }}
          />
          <h1 className="text-xl font-bold font-serif">L'atelier aux mille trésors</h1>
        </div>

        {/* Bouton Panier assorti */}
        <button
          onClick={() => setIsCartOpen(!isCartOpen)}
          style={{ backgroundColor: '#3c2820', color: '#ffffff' }}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold shadow transition hover:opacity-90 active:scale-95"
        >
          <span>🛒 Panier</span>
          <span className="bg-white text-[#3c2820] text-xs px-2 py-0.5 rounded-full font-bold">
            {totalItemsCount}
          </span>
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 relative">
        {isAdminOpen && (
          <div className="mb-10 bg-white p-6 rounded-2xl border border-[#e7dfe3] shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">⚙️ Espace Administrateur</h2>
              <button onClick={() => setIsAdminOpen(false)} className="text-xs bg-gray-200 px-3 py-1 rounded-lg">Fermer</button>
            </div>
            <form onSubmit={handleAddProduct} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input type="text" placeholder="Nom" value={newProduct.nom} onChange={(e) => setNewProduct({ ...newProduct, nom: e.target.value })} className="p-2 border rounded-lg text-sm" />
              <input type="number" step="0.01" placeholder="Prix en €" value={newProduct.prix} onChange={(e) => setNewProduct({ ...newProduct, prix: e.target.value })} className="p-2 border rounded-lg text-sm" />
              <select value={newProduct.categorie} onChange={(e) => setNewProduct({ ...newProduct, categorie: e.target.value })} className="p-2 border rounded-lg text-sm">
                <option value="Créations florales">Créations florales</option>
                <option value="Objets en bois">Objets en bois</option>
                <option value="Décoration">Décoration</option>
              </select>
              <input type="text" placeholder="URL image" value={newProduct.imgUrl} onChange={(e) => setNewProduct({ ...newProduct, imgUrl: e.target.value })} className="p-2 border rounded-lg text-sm" />
              <button type="submit" style={{ backgroundColor: '#3c2820', color: '#ffffff' }} className="sm:col-span-2 py-2 rounded-lg font-semibold">Publier</button>
            </form>
          </div>
        )}

        <div className="space-y-6">
          <h2 className="text-2xl font-serif font-bold">Nos Créations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {products.map((product) => {
              const displayPrice = typeof product.prix === 'string' ? parseFloat(product.prix) : product.prix;
              return (
                <div key={product.id} className="bg-white rounded-xl overflow-hidden border border-[#e7dfe3] shadow-sm flex flex-col justify-between">
                  <div>
                    <img src={product.img} alt={product.nom} className="w-full h-48 object-cover" />
                    <div className="p-4">
                      <span className="text-xs text-amber-700 font-semibold uppercase">{product.categorie}</span>
                      <h3 className="font-serif font-bold text-lg mt-1">{product.nom}</h3>
                      <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                    </div>
                  </div>
                  
                  <div className="p-4 pt-2 flex items-center justify-between border-t border-gray-100 bg-gray-50/50">
                    <span className="font-bold text-lg">
                      {!isNaN(displayPrice) ? displayPrice.toFixed(2) : '0.00'} €
                    </span>
                    <div className="flex items-center gap-2">
                      {isAdminOpen && (
                        <button onClick={() => handleDeleteProduct(product.id)} className="text-red-500 text-xs px-2 py-1 border border-red-200 rounded bg-white">
                          Supprimer
                        </button>
                      )}
                      <button
                        onClick={() => addToCart(product)}
                        style={{ backgroundColor: '#3c2820', color: '#ffffff' }}
                        className="px-4 py-2 rounded-lg text-sm font-bold shadow transition hover:opacity-90 active:scale-95"
                      >
                        Ajouter
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isCartOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div className="absolute inset-0 bg-black bg-opacity-30" onClick={() => setIsCartOpen(false)} />
            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <div className="w-screen max-w-md bg-white shadow-xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b">
                    <h2 className="text-lg font-serif font-bold">Votre Panier</h2>
                    <button onClick={() => setIsCartOpen(false)} className="text-gray-400 font-bold text-lg px-2">✕</button>
                  </div>
                  {cart.length === 0 ? (
                    <p className="text-sm text-gray-500 mt-6 text-center">Votre panier est vide.</p>
                  ) : (
                    <div className="divide-y divide-gray-100 mt-4 max-h-[60vh] overflow-y-auto">
                      {cart.map((item) => (
                        <div key={item.id} className="py-3 flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-sm">{item.nom}</h4>
                            <p className="text-xs text-gray-500">{item.prix.toFixed(2)} € x {item.quantity}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button onClick={() => updateQuantity(item.id, -1)} className="px-2.5 py-1 bg-gray-100 rounded text-sm font-bold">-</button>
                            <span className="text-sm font-semibold w-4 text-center">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, 1)} className="px-2.5 py-1 bg-gray-100 rounded text-sm font-bold">+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="pt-4 border-t space-y-4">
                  <div className="flex justify-between items-baseline font-bold">
                    <span>Total</span>
                    <span className="text-xl">{totalAmount.toFixed(2)} €</span>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={loading || cart.length === 0}
                    style={{ backgroundColor: '#3c2820', color: '#ffffff' }}
                    className="w-full py-3 font-semibold rounded-xl shadow disabled:opacity-50"
                  >
                    {loading ? 'Paiement en cours...' : `Payer ${totalAmount.toFixed(2)} € avec Stripe`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}