import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { loadStripe } from '@stripe/stripe-js';
import emailjs from '@emailjs/browser';

const stripePromise = loadStripe('pk_live_51UAwTd1sw06fcAlG3gEh2Ko6LdRuo0uiwaBfsUPWiPQ4fdq1xx6xtVxMKnmWCwzIr5rlrhstO533TGeoDWHYFSsY00kiYfp7Wr');

// ==========================================
// CONFIGURATION EMAILJS & IDENTIFIANTS
// ==========================================
const EMAILJS_SERVICE_ID = 'service_xsiu4de';
const EMAILJS_TEMPLATE_ID = 'template_814jv1h';
const EMAILJS_PUBLIC_KEY = 'BIjG1I0PqxOF4gcWz';

// ID de ton Stripe Payment Link
const STRIPE_PAYMENT_LINK_ID = 'aFaeV54b66sj3eGb1FaEE00';

interface Product {
  id: number;
  nom: string;  
  prix: string | number;
  categorie: string;
  img: string;
  description: string;
  is_customizable?: boolean;
  custom_label?: string;
}

interface CartItem {
  id: number;
  nom: string;
  prix: number;
  quantity: number;
  is_customizable?: boolean;
  customValue?: string;
  customLabel?: string;
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'shipping'>('cart');

  // Stockage temporaire des valeurs de personnalisation pour chaque produit avant l'ajout au panier
  const [customInputs, setCustomInputs] = useState<{ [productId: number]: string }>({});

  const [shippingInfo, setShippingInfo] = useState({
    prenom: '',
    nom: '',
    email: '',
    adresse: '',
    codePostal: '',
    ville: ''
  });

  const logoClicksRef = useRef(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [newProduct, setNewProduct] = useState({
    nom: '',
    prix: '',
    categorie: 'Créations florales',
    imgUrl: '',
    description: '',
    is_customizable: false,
    custom_label: 'Prénom ou couleur souhaitée'
  });

  const [categories, setCategories] = useState<string[]>([
    'Créations florales',
    'Objets en bois',
    'Sur-mesure'
  ]);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    fetchProducts();

    const queryParams = new URLSearchParams(window.location.search);
    if (queryParams.get('success') === 'true') {
      window.history.replaceState({}, document.title, window.location.pathname);
      setCart([]);
    } else if (queryParams.get('canceled') === 'true') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setProducts(data);
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
        if (pwd === 'admin123') {
          setIsAdminOpen(true);
        }
        else if (pwd !== null) alert('Mot de passe incorrect !');
      } else {
        setIsAdminOpen(false);
      }
    }
  };

  const addToCart = (product: Product) => {
    const numericPrice = typeof product.prix === 'string' ? parseFloat(product.prix) : product.prix;
    const customVal = customInputs[product.id] || '';

    // Si le produit est personnalisable, vérifier que le champ est rempli
    if (product.is_customizable && !customVal.trim()) {
      return alert(`Veuillez remplir le champ de personnalisation (${product.custom_label || 'Personnalisation'}) avant d'ajouter l'article au panier.`);
    }

    setCart((prevCart) => {
      // Si l'article est personnalisable, on le traite comme une ligne distincte s'il a une personnalisation différente
      const existingIndex = prevCart.findIndex(
        (item) => item.id === product.id && item.customValue === customVal
      );

      if (existingIndex > -1) {
        const updated = [...prevCart];
        updated[existingIndex].quantity += 1;
        return updated;
      }

      return [
        ...prevCart,
        {
          id: product.id,
          nom: product.nom,
          prix: numericPrice,
          quantity: 1,
          is_customizable: product.is_customizable,
          customValue: customVal,
          customLabel: product.custom_label
        }
      ];
    });

    // Réinitialiser le champ de saisie pour ce produit
    setCustomInputs(prev => ({ ...prev, [product.id]: '' }));
    alert('Article ajouté au panier !');
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prevCart) => {
      const updated = [...prevCart];
      const newQty = updated[index].quantity + delta;
      if (newQty > 0) {
        updated[index].quantity = newQty;
      } else {
        updated.splice(index, 1);
      }
      return updated;
    });
  };

  const removeCartItem = (index: number) => {
    setCart((prevCart) => prevCart.filter((_, i) => i !== index));
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.prix * item.quantity, 0);
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      
      setUploadingImage(true);
      const file = files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('images').getPublicUrl(filePath);
      setNewProduct((prev) => ({ ...prev, imgUrl: data.publicUrl }));
      alert('Image uploadée avec succès !');
    } catch (error) {
      alert("Erreur lors de l'upload de l'image.");
      console.error(error);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddProductReal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.nom.trim() || !newProduct.prix.trim()) {
      return alert('Merci de renseigner un nom et un prix.');
    }

    let finalCategory = newProduct.categorie;
    if (newCategory.trim()) {
      finalCategory = newCategory.trim();
      if (!categories.includes(finalCategory)) {
        setCategories([...categories, finalCategory]);
      }
    }

    const itemToInsert = {
      nom: newProduct.nom.trim(),
      prix: parseFloat(newProduct.prix).toFixed(2),
      categorie: finalCategory,
      img: newProduct.imgUrl.trim() || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500',
      description: newProduct.description.trim() || 'Création artisanale de L’atelier aux mille trésors.',
      is_customizable: newProduct.is_customizable,
      custom_label: newProduct.is_customizable ? newProduct.custom_label.trim() : null
    };

    const { error } = await supabase.from('products').insert([itemToInsert]);

    if (error) {
      alert("Erreur lors de l'enregistrement du produit.");
    } else {
      alert('Produit ajouté avec succès !');
      setNewProduct({
        nom: '',
        prix: '',
        categorie: categories[0] || 'Créations florales',
        imgUrl: '',
        description: '',
        is_customizable: false,
        custom_label: 'Prénom ou couleur souhaitée'
      });
      setNewCategory('');
      fetchProducts();
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Voulez-vous vraiment supprimer ce produit ?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) fetchProducts();
  };

  const handleCheckoutPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shippingInfo.prenom || !shippingInfo.nom || !shippingInfo.email || !shippingInfo.adresse || !shippingInfo.codePostal || !shippingInfo.ville) {
      return alert('Veuillez remplir tous les champs de livraison.');
    }

    // Double vérification de sécurité du panier avant validation
    for (const item of cart) {
      if (item.is_customizable && !item.customValue?.trim()) {
        return alert(`L'article "${item.nom}" requiert une personnalisation. Veuillez vérifier votre panier.`);
      }
    }

    setLoading(true);
    try {
      const detailsPanier = cart.map(item => {
        const customText = item.customValue ? ` (Perso: ${item.customValue})` : '';
        return `- ${item.quantity}x ${item.nom}${customText} — ${(item.prix * item.quantity).toFixed(2)} €`;
      }).join('\n');
      
      const emailParams = {
        name: `${shippingInfo.prenom} ${shippingInfo.nom}`,
        client_nom: `${shippingInfo.prenom} ${shippingInfo.nom}`,
        client_email: shippingInfo.email,
        adresse_livraison: `${shippingInfo.adresse}, ${shippingInfo.codePostal} ${shippingInfo.ville}`,
        articles: detailsPanier,
        total: `${totalAmount.toFixed(2)} €`
      };

      // Envoi de l'e-mail de confirmation via EmailJS
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        emailParams,
        EMAILJS_PUBLIC_KEY
      );

      // URL de ton Stripe Payment Link
      const stripeUrl = `https://buy.stripe.com/${STRIPE_PAYMENT_LINK_ID}?prefilled_email=${encodeURIComponent(shippingInfo.email)}`;

      setLoading(false);
      
      // Ouverture sécurisée de Stripe dans un nouvel onglet
      window.open(stripeUrl, '_blank');

    } catch (error) {
      console.error(error);
      alert("Erreur lors de l'envoi de l'e-mail ou de la redirection vers le paiement.");
      setLoading(false);
    }
  };

  // Vue Admin
  if (isAdminOpen) {
    return (
      <div className="min-h-screen bg-[#faf7f2] text-[#3c2820] font-sans p-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center mb-8">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold font-serif">Administration - Produits ({products.length})</h1>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setIsAdminOpen(false)} className="px-4 py-2 bg-white border border-[#3c2820]/20 rounded-xl text-sm font-semibold shadow-xs hover:bg-[#f5efe6]">Voir le site</button>
            <button onClick={() => setIsAdminOpen(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">Quitter</button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-[#3c2820]/15 shadow-sm md:col-span-1 h-fit space-y-4">
              <h2 className="text-lg font-bold">➕ Ajouter un article</h2>
              <form onSubmit={handleAddProductReal} className="space-y-3">
                <input type="text" placeholder="Nom du produit" value={newProduct.nom} onChange={(e) => setNewProduct({ ...newProduct, nom: e.target.value })} className="w-full p-3 border border-[#3c2820]/20 rounded-xl text-sm focus:outline-none" />
                <input type="number" step="0.01" placeholder="Prix (€)" value={newProduct.prix} onChange={(e) => setNewProduct({ ...newProduct, prix: e.target.value })} className="w-full p-3 border border-[#3c2820]/20 rounded-xl text-sm focus:outline-none" />
                
                <select value={newProduct.categorie} onChange={(e) => setNewProduct({ ...newProduct, categorie: e.target.value })} className="w-full p-3 border border-[#3c2820]/20 rounded-xl text-sm bg-white">
                  {categories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                </select>

                <input type="text" placeholder="Ou nouvelle catégorie..." value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full p-3 border border-dashed border-[#3c2820]/30 rounded-xl text-sm" />
                
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Importer une image :</label>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full p-2 border border-[#3c2820]/20 rounded-xl text-xs bg-[#faf7f2]" />
                  {uploadingImage && <p className="text-xs text-amber-700">Upload en cours...</p>}
                  {newProduct.imgUrl && !uploadingImage && <p className="text-xs text-green-600">✓ Image prête</p>}
                </div>

                <textarea placeholder="Description" value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} className="w-full p-3 border border-[#3c2820]/20 rounded-xl text-sm" rows={2}></textarea>

                {/* Section Personnalisation Admin */}
                <div className="p-3 bg-[#faf7f2] rounded-xl border border-[#3c2820]/10 space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newProduct.is_customizable}
                      onChange={(e) => setNewProduct({ ...newProduct, is_customizable: e.target.checked })}
                      className="rounded text-[#c58a79] focus:ring-0"
                    />
                    <span className="text-xs font-bold">Article personnalisable ?</span>
                  </label>

                  {newProduct.is_customizable && (
                    <input
                      type="text"
                      placeholder="Libellé (ex: Prénom, Couleur, Texte...)"
                      value={newProduct.custom_label}
                      onChange={(e) => setNewProduct({ ...newProduct, custom_label: e.target.value })}
                      className="w-full p-2.5 bg-white border border-[#3c2820]/20 rounded-lg text-xs"
                    />
                  )}
                </div>

                <button type="submit" style={{ backgroundColor: '#c58a79', color: '#ffffff' }} className="w-full py-3 font-semibold rounded-xl shadow-xs transition hover:opacity-90">Publier</button>
              </form>
            </div>

            <div className="md:col-span-2 space-y-6">
              <h2 className="text-xl font-serif font-bold">Catalogue actuel</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {products.map((product) => (
                  <div key={product.id} className="bg-white rounded-2xl overflow-hidden border border-[#3c2820]/15 shadow-xs flex flex-col justify-between p-4">
                    <div>
                      <div className="w-full h-36 bg-[#f3efe6] rounded-xl overflow-hidden mb-3 flex items-center justify-center">
                        <img src={product.img} alt={product.nom} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] bg-[#faf7f2] text-[#3c2820] px-2.5 py-1 rounded-full font-semibold uppercase">{product.categorie}</span>
                        {product.is_customizable && (
                          <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">✨ Personnalisable</span>
                        )}
                      </div>
                      <h3 className="font-serif font-bold text-base mt-2">{product.nom}</h3>
                      <p className="text-sm font-bold mt-1 text-[#c58a79]">{Number(product.prix).toFixed(2)} €</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                      <button onClick={() => handleDeleteProduct(product.id)} className="text-gray-400 hover:text-red-500 p-1 text-sm">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Vue Client
  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#3c2820] font-sans pb-16 relative">
      <header className="py-4 px-6 bg-white border-b border-[#3c2820]/10 sticky top-0 z-20 flex justify-between items-center shadow-xs">
        <div onClick={handleLogoClick} className="flex items-center space-x-3 cursor-pointer select-none">
          <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain rounded-full" />
          <h1 className="text-xl font-bold font-serif">L'atelier aux mille trésors</h1>
        </div>
        
        <button
          onClick={() => { setIsCartOpen(true); setCheckoutStep('cart'); }}
          style={{ backgroundColor: '#c58a79', color: '#ffffff' }}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition shadow-xs hover:opacity-90"
        >
          <span>Panier ({totalItemsCount} - {totalAmount.toFixed(2)} €)</span>
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="space-y-6">
          <h2 className="text-2xl font-serif font-bold">Nos Créations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {products.map((product) => {
              const displayPrice = typeof product.prix === 'string' ? parseFloat(product.prix) : product.prix;
              return (
                <div key={product.id} className="bg-white rounded-2xl overflow-hidden border border-[#3c2820]/15 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="w-full h-64 bg-[#f3efe6] overflow-hidden relative flex items-center justify-center">
                      <img src={product.img} alt={product.nom} className="w-full h-full object-cover hover:scale-105 transition duration-300" />
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] bg-[#faf7f2] px-2.5 py-1 rounded-full text-[#3c2820] font-semibold uppercase">{product.categorie}</span>
                        {product.is_customizable && (
                          <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">✨ Personnalisable</span>
                        )}
                      </div>
                      <h3 className="font-serif font-bold text-lg">{product.nom}</h3>
                      <p className="text-sm text-gray-600">{product.description}</p>

                      {/* Champ de personnalisation si activé pour ce produit */}
                      {product.is_customizable && (
                        <div className="pt-2 border-t border-gray-100">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            {product.custom_label || 'Personnalisation'} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder={`Entrez ${product.custom_label || 'votre choix'}`}
                            value={customInputs[product.id] || ''}
                            onChange={(e) => setCustomInputs({ ...customInputs, [product.id]: e.target.value })}
                            className="w-full p-2.5 bg-[#faf7f2] border border-[#3c2820]/20 rounded-xl text-xs focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-4 pt-2 flex items-center justify-between border-t border-gray-100 bg-white">
                    <span className="font-bold text-lg">{!isNaN(displayPrice) ? displayPrice.toFixed(2) : '0.00'} €</span>
                    <button
                      onClick={() => addToCart(product)}
                      style={{ backgroundColor: '#c58a79', color: '#ffffff' }}
                      className="px-5 py-2 rounded-xl text-sm font-semibold shadow-xs transition hover:opacity-90 active:scale-95"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isCartOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div className="absolute inset-0 bg-black bg-opacity-30 backdrop-blur-xs" onClick={() => setIsCartOpen(false)} />
            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <div className="w-screen max-w-md bg-white shadow-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-[#3c2820]/10">
                    {checkoutStep === 'shipping' ? (
                      <button onClick={() => setCheckoutStep('cart')} className="text-xs font-semibold text-gray-600">← Retour au panier</button>
                    ) : (
                      <h2 className="text-lg font-serif font-bold">Mon Panier</h2>
                    )}
                    <button onClick={() => setIsCartOpen(false)} className="text-gray-400 hover:text-black font-bold text-lg px-2">✕</button>
                  </div>

                  {checkoutStep === 'cart' ? (
                    <>
                      {cart.length === 0 ? (
                        <p className="text-sm text-gray-500 mt-10 text-center">Votre panier est vide.</p>
                      ) : (
                        <div className="divide-y divide-gray-100 mt-4 max-h-[55vh] overflow-y-auto pr-1">
                          {cart.map((item, index) => (
                            <div key={index} className="py-3 flex items-center justify-between">
                              <div className="pr-2">
                                <h4 className="font-medium text-sm">{item.nom}</h4>
                                <p className="text-xs text-gray-500">{(item.prix).toFixed(2)} €</p>
                                {item.is_customizable && (
                                  <p className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded mt-1 border border-amber-200">
                                    <strong>{item.customLabel || 'Perso'} :</strong> {item.customValue}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center space-x-2 shrink-0">
                                <button onClick={() => updateQuantity(index, -1)} className="px-2.5 py-1 bg-gray-100 rounded-lg text-sm font-bold">-</button>
                                <span className="text-sm font-semibold w-4 text-center">{item.quantity}</span>
                                <button onClick={() => updateQuantity(index, 1)} className="px-2.5 py-1 bg-gray-100 rounded-lg text-sm font-bold">+</button>
                                <button onClick={() => removeCartItem(index)} className="text-gray-400 hover:text-red-500 ml-2 text-xs">🗑️</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <form onSubmit={handleCheckoutPayment} id="shipping-form" className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                      <h3 className="font-serif font-bold text-sm text-[#3c2820] mb-2">Informations de livraison & Paiement</h3>
                      <input type="text" placeholder="Prénom" required value={shippingInfo.prenom} onChange={(e)=>setShippingInfo({...shippingInfo, prenom: e.target.value})} className="w-full p-2.5 border border-[#3c2820]/20 rounded-xl text-sm" />
                      <input type="text" placeholder="Nom" required value={shippingInfo.nom} onChange={(e)=>setShippingInfo({...shippingInfo, nom: e.target.value})} className="w-full p-2.5 border border-[#3c2820]/20 rounded-xl text-sm" />
                      <input type="email" placeholder="Adresse e-mail" required value={shippingInfo.email} onChange={(e)=>setShippingInfo({...shippingInfo, email: e.target.value})} className="w-full p-2.5 border border-[#3c2820]/20 rounded-xl text-sm" />
                      <input type="text" placeholder="Adresse postale" required value={shippingInfo.adresse} onChange={(e)=>setShippingInfo({...shippingInfo, adresse: e.target.value})} className="w-full p-2.5 border border-[#3c2820]/20 rounded-xl text-sm" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" placeholder="Code postal" required value={shippingInfo.codePostal} onChange={(e)=>setShippingInfo({...shippingInfo, codePostal: e.target.value})} className="p-2.5 border border-[#3c2820]/20 rounded-xl text-sm" />
                        <input type="text" placeholder="Ville" required value={shippingInfo.ville} onChange={(e)=>setShippingInfo({...shippingInfo, ville: e.target.value})} className="p-2.5 border border-[#3c2820]/20 rounded-xl text-sm" />
                      </div>
                      <p className="text-[11px] text-gray-400 pt-1">Le numéro de téléphone vous sera demandé de manière sécurisée lors de l'étape de paiement sur Stripe.</p>
                    </form>
                  )}
                </div>

                <div className="pt-4 border-t border-[#3c2820]/10 space-y-4">
                  <div className="flex justify-between items-baseline font-bold">
                    <span>Total :</span>
                    <span className="text-xl">{totalAmount.toFixed(2)} €</span>
                  </div>

                  {checkoutStep === 'cart' ? (
                    <button
                      onClick={() => {
                        // Vérification que tous les articles personnalisés ont bien leur valeur
                        for (const item of cart) {
                          if (item.is_customizable && !item.customValue?.trim()) {
                            alert(`L'article "${item.nom}" nécessite que vous remplissiez sa personnalisation.`);
                            return;
                          }
                        }
                        setCheckoutStep('shipping');
                      }}
                      disabled={cart.length === 0}
                      style={{ backgroundColor: '#c58a79', color: '#ffffff' }}
                      className="w-full py-3 font-semibold rounded-xl shadow-xs transition hover:opacity-90 disabled:opacity-50"
                    >
                      Passer à la livraison
                    </button>
                  ) : (
                    <button
                      type="submit"
                      form="shipping-form"
                      disabled={loading}
                      style={{ backgroundColor: '#c58a79', color: '#ffffff' }}
                      className="w-full py-3 font-semibold rounded-xl shadow-xs transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? 'Redirection...' : `Payer par carte (${totalAmount.toFixed(2)} €) 💳`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}s