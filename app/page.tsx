"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/utils/supabase/client";

type Product = {
  id: number;
  name: string;
  price: number;
  image: string;
  category: string;
};

type CartItem = Product & {
  quantity: number;
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [userEmail, setUserEmail] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCity, setCustomerCity] = useState("");

  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);

  const [confirmedOrderTotal, setConfirmedOrderTotal] =
    useState(0);

  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterMessage, setNewsletterMessage] = useState("");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // -----------------------------
  // LOAD PRODUCTS
  // -----------------------------
  useEffect(() => {
    const loadProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("id", { ascending: true });

      if (error) {
        console.error("Product loading error:", error);
        return;
      }

      setProducts(data || []);
    };

    loadProducts();
  }, []);

  // -----------------------------
  // LOAD AUTH USER
  // -----------------------------
  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUserEmail(user?.email || "");
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email || "");
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // -----------------------------
  // SIGN OUT
  // -----------------------------
  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Sign out error:", error);
      alert("We couldn't sign you out. Please try again.");
      return;
    }

    setUserEmail("");
  };

  // -----------------------------
  // CART TOTAL
  // -----------------------------
  const cartTotal = useMemo(() => {
    return cart.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
  }, [cart]);

  // -----------------------------
  // ADD TO CART
  // -----------------------------
  const addToCart = (product: Product) => {
    setCart((currentCart) => {
      const existingItem = currentCart.find(
        (item) => item.id === product.id
      );

      if (existingItem) {
        return currentCart.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...currentCart,
        {
          ...product,
          quantity: 1,
        },
      ];
    });

    setCartOpen(true);
  };

  // -----------------------------
  // REMOVE FROM CART
  // -----------------------------
  const removeFromCart = (productId: number) => {
    setCart((currentCart) =>
      currentCart.filter((item) => item.id !== productId)
    );
  };

  // -----------------------------
  // NAVIGATION
  // -----------------------------
  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);

    const element = document.getElementById(id);

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  // -----------------------------
  // CHECKOUT
  // -----------------------------
  const openCheckout = () => {
    if (cart.length === 0) {
      alert("Your bag is empty.");
      return;
    }

    setCartOpen(false);
    setCheckoutOpen(true);
    setOrderPlaced(false);
    sessionStorage.removeItem(
      "fhush_completed_payment_reference"
    );
  };

  // -----------------------------
  // COMPLETE PAID ORDER
  // -----------------------------
  const completePaidOrder = async (paymentReference: string) => {
    const pendingPayment = sessionStorage.getItem(
      "fhush_pending_payment"
    );

    const completedReference = sessionStorage.getItem(
      "fhush_completed_payment_reference"
    );

    if (
      completedReference &&
      completedReference === paymentReference
    ) {
      return;
    }

    if (!pendingPayment) {
      console.error("No pending payment information found.");
      setPlacingOrder(false);
      return;
    }

    try {
      const payment = JSON.parse(pendingPayment);

      setPlacingOrder(true);

      // --------------------------------
      // VERIFY PAYMENT ON SERVER
      // --------------------------------
      const verifyResponse = await fetch(
        "/api/verify-payment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reference: paymentReference,
            expectedAmount: payment.orderTotal,
          }),
        }
      );

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyData.success) {
        console.error(
          "Payment verification failed:",
          verifyData
        );

        alert(
          verifyData?.error ||
            "We couldn't verify your payment. Please contact support."
        );

        setPlacingOrder(false);
        return;
      }

      // --------------------------------
      // PAYMENT VERIFIED
      // CREATE ORDER
      // --------------------------------
      const { data, error } = await supabase.rpc(
        "create_order",
        {
          customer_name_input:
            payment.customerName,

          customer_email_input:
            payment.customerEmail,

          customer_phone_input:
            payment.customerPhone,

          address_input:
            payment.customerAddress,

          city_input:
            payment.customerCity,

          total_input:
            payment.orderTotal,

          items_input:
            payment.orderItems,
        }
      );

      if (error) {
        console.error(
          "Order creation error:",
          error
        );

        alert(
          "Payment was successful, but we couldn't save your order. Please contact support immediately."
        );

        setPlacingOrder(false);
        return;
      }

      console.log(
        "Paid order created:",
        data
      );

      sessionStorage.setItem(
        "fhush_completed_payment_reference",
        paymentReference
      );

      // --------------------------------
      // SAVE CONFIRMED TOTAL
      // --------------------------------
      setConfirmedOrderTotal(
        payment.orderTotal
      );

      // --------------------------------
      // SEND CONFIRMATION EMAIL
      // --------------------------------
      try {
        const emailResponse =
          await fetch(
            "/api/send-order-email",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                customerName:
                  payment.customerName,

                customerEmail:
                  payment.customerEmail,

                orderTotal:
                  payment.orderTotal,

                orderId: data,
              }),
            }
          );

        const emailResult =
          await emailResponse.json();

        if (!emailResponse.ok) {
          console.error(
            "Order email failed:",
            emailResult?.error
          );
        } else {
          console.log(
            "Order confirmation email sent."
          );
        }
      } catch (emailError) {
        console.error(
          "Could not send order confirmation email:",
          emailError
        );
      }

      // --------------------------------
      // RESTORE CUSTOMER DETAILS
      // --------------------------------
      setCustomerName(
        payment.customerName
      );

      setCustomerEmail(
        payment.customerEmail
      );

      setCustomerPhone(
        payment.customerPhone
      );

      setCustomerAddress(
        payment.customerAddress
      );

      setCustomerCity(
        payment.customerCity
      );

      // --------------------------------
      // SHOW CONFIRMATION
      // --------------------------------
      setOrderPlaced(true);
      setCheckoutOpen(true);

      // Clear cart
      setCart([]);

      // Clear pending payment
      sessionStorage.removeItem(
        "fhush_pending_payment"
      );

      sessionStorage.removeItem(
        "fhush_completed_payment_reference"
      );

      setPlacingOrder(false);
    } catch (error) {
      console.error(
        "Post-payment processing error:",
        error
      );

      alert(
        "Your payment was received, but we had trouble completing your order. Please contact support."
      );

      setPlacingOrder(false);
    }
  };

  // -----------------------------
  // PLACE ORDER / PAYSTACK
  // -----------------------------
  const placeOrder = async () => {
    if (!customerName.trim()) {
      alert("Please enter your full name.");
      return;
    }

    if (!customerEmail.trim()) {
      alert("Please enter your email address.");
      return;
    }

    if (!customerPhone.trim()) {
      alert("Please enter your phone number.");
      return;
    }

    if (!customerAddress.trim()) {
      alert("Please enter your delivery address.");
      return;
    }

    if (!customerCity.trim()) {
      alert("Please enter your city.");
      return;
    }

    if (cart.length === 0) {
      alert("Your bag is empty.");
      return;
    }

    try {
      setPlacingOrder(true);

      const orderTotal = cartTotal;

      const orderItems = cart.map((item) => ({
        product_id: item.id,
        product_name: item.name,
        price: item.price,
        quantity: item.quantity,
      }));

      // --------------------------------
      // GENERATE UNIQUE PAYMENT REFERENCE
      // --------------------------------
      const reference = `FHUSH-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase()}`;

      // --------------------------------
      // INITIALIZE PAYMENT ON SERVER
      // --------------------------------
      const paymentResponse = await fetch(
        "/api/paystack",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: customerEmail,
            amount: orderTotal,
            reference,
          }),
        }
      );

      const paymentData = await paymentResponse.json();

      if (!paymentResponse.ok) {
        console.error(
          "Paystack initialization error:",
          paymentData
        );

        alert(
          paymentData?.error ||
            "We couldn't start your payment. Please try again."
        );

        setPlacingOrder(false);
        return;
      }

      if (!paymentData.access_code) {
        console.error(
          "Paystack did not return an access code:",
          paymentData
        );

        alert(
          "We couldn't start the payment. Please try again."
        );

        setPlacingOrder(false);
        return;
      }

      // --------------------------------
      // SAVE PAYMENT INFORMATION BEFORE
      // OPENING PAYSTACK
      // --------------------------------
      sessionStorage.setItem(
        "fhush_pending_payment",
        JSON.stringify({
          reference,
          orderTotal,
          customerName,
          customerEmail,
          customerPhone,
          customerAddress,
          customerCity,
          orderItems,
        })
      );

      // --------------------------------
      // LOAD PAYSTACK ONLY IN THE BROWSER
      // --------------------------------
      const { default: PaystackPop } = await import(
        "@paystack/inline-js"
      );

      const paystack = new PaystackPop();

      // --------------------------------
      // OPEN PAYSTACK USING ACCESS CODE
      // AND HANDLE SUCCESS DIRECTLY
      // --------------------------------
      paystack.resumeTransaction(
        paymentData.access_code,
        {
          onSuccess: async (transaction) => {
            const successfulReference =
              transaction?.reference ||
              transaction?.trxref ||
              reference;

            console.log(
              "Paystack payment successful:",
              successfulReference
            );

            await completePaidOrder(successfulReference);
          },

          onCancel: () => {
            console.log("Paystack payment cancelled.");
            setPlacingOrder(false);
          },

          onError: (error) => {
            console.error("Paystack error:", error);
            setPlacingOrder(false);

            alert(
              error?.message ||
                "There was a problem opening Paystack. Please try again."
            );
          },
        }
      );
    } catch (error) {
      console.error(
        "Unexpected payment error:",
        error
      );

      setPlacingOrder(false);

      alert(
        "Something went wrong while starting your payment."
      );
    }
  };

  // -----------------------------
  // NEWSLETTER
  // -----------------------------
  const handleNewsletterSubmit = (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!newsletterEmail.trim()) {
      setNewsletterMessage(
        "Please enter your email address."
      );

      return;
    }

    setNewsletterMessage(
      "Thank you. You are now on the FhushDesigns list."
    );

    setNewsletterEmail("");
  };

  // -----------------------------
  // PRODUCT FALLBACK
  // -----------------------------
  const fallbackProducts: Product[] = [
    {
      id: 1,
      name: "Classic Office Two-Piece",
      price: 45000,
      image: "/products/office-two-piece.jpg",
      category: "Two-Piece",
    },
    {
      id: 2,
      name: "Elegant Maxi Dress",
      price: 38000,
      image: "/products/maxi-dress.jpg",
      category: "Dresses",
    },
    {
      id: 3,
      name: "Structured Blouse",
      price: 25000,
      image: "/products/structured-blouse.jpg",
      category: "Tops",
    },
    {
      id: 4,
      name: "Pleated Midi Skirt",
      price: 28000,
      image: "/products/pleated-skirt.jpg",
      category: "Skirts",
    },
    {
      id: 5,
      name: "Modest Corporate Gown",
      price: 40000,
      image: "/products/corporate-gown.jpg",
      category: "Dresses",
    },
    {
      id: 6,
      name: "Classic Ready-to-Wear Set",
      price: 42000,
      image: "/products/ready-to-wear-set.jpg",
      category: "Sets",
    },
  ];

  const displayedProducts =
    products.length > 0
      ? products
      : fallbackProducts;

  // -----------------------------
  // FORMAT PRICE
  // -----------------------------
  const formatPrice = (price: number) => {
    return `₦${price.toLocaleString(
      "en-NG"
    )}`;
  };

  return (
    <main className="min-h-screen bg-[#f8f6f1] text-black">
      {/* ANNOUNCEMENT BAR */}
      <div className="bg-black px-4 py-3 text-center text-[10px] tracking-[0.25em] text-white">
        FREE DELIVERY ON ORDERS OVER ₦100,000
      </div>

      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-black/10 bg-[#f8f6f1]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <button
            onClick={() =>
              scrollToSection("home")
            }
            className="flex items-center"
          >
            <img
              src="/logo.png"
              alt="FhushDesigns"
              className="h-10 w-auto object-contain"
            />
          </button>

          <nav className="hidden items-center gap-8 md:flex">
            <button
              onClick={() =>
                scrollToSection("home")
              }
              className="text-xs tracking-[0.15em] transition hover:opacity-50"
            >
              HOME
            </button>

            <button
              onClick={() =>
                scrollToSection("shop")
              }
              className="text-xs tracking-[0.15em] transition hover:opacity-50"
            >
              SHOP
            </button>

            <button
              onClick={() =>
                scrollToSection("collections")
              }
              className="text-xs tracking-[0.15em] transition hover:opacity-50"
            >
              COLLECTIONS
            </button>

            <button
              onClick={() =>
                scrollToSection("story")
              }
              className="text-xs tracking-[0.15em] transition hover:opacity-50"
            >
              OUR STORY
            </button>
          </nav>

          <div className="flex items-center gap-3">
            {userEmail ? (
              <button
                onClick={handleSignOut}
                className="hidden border border-black px-4 py-2 text-xs tracking-wider transition hover:bg-black hover:text-white sm:block"
              >
                SIGN OUT
              </button>
            ) : (
              <button
                onClick={() => {
                  window.location.href =
                    "/login";
                }}
                className="hidden border border-black px-4 py-2 text-xs tracking-wider transition hover:bg-black hover:text-white sm:block"
              >
                SIGN IN
              </button>
            )}

            <button
              onClick={() =>
                setCartOpen(true)
              }
              className="relative border border-black px-4 py-2 text-xs tracking-wider transition hover:bg-black hover:text-white"
            >
              BAG

              {cart.length > 0 && (
                <span className="ml-2">
                  (
                  {cart.reduce(
                    (sum, item) =>
                      sum + item.quantity,
                    0
                  )}
                  )
                </span>
              )}
            </button>

            <button
              onClick={() =>
                setMobileMenuOpen(
                  !mobileMenuOpen
                )
              }
              className="border border-black px-3 py-2 text-xs md:hidden"
            >
              MENU
            </button>
          </div>
        </div>

        {/* MOBILE MENU */}
        {mobileMenuOpen && (
          <div className="border-t border-black/10 bg-[#f8f6f1] px-6 py-6 md:hidden">
            <div className="flex flex-col gap-5">
              <button
                onClick={() =>
                  scrollToSection("home")
                }
                className="text-left text-xs tracking-[0.15em]"
              >
                HOME
              </button>

              <button
                onClick={() =>
                  scrollToSection("shop")
                }
                className="text-left text-xs tracking-[0.15em]"
              >
                SHOP
              </button>

              <button
                onClick={() =>
                  scrollToSection(
                    "collections"
                  )
                }
                className="text-left text-xs tracking-[0.15em]"
              >
                COLLECTIONS
              </button>

              <button
                onClick={() =>
                  scrollToSection("story")
                }
                className="text-left text-xs tracking-[0.15em]"
              >
                OUR STORY
              </button>

              {userEmail ? (
                <button
                  onClick={() => {
                    handleSignOut();
                    setMobileMenuOpen(false);
                  }}
                  className="text-left text-xs tracking-[0.15em]"
                >
                  SIGN OUT
                </button>
              ) : (
                <button
                  onClick={() => {
                    window.location.href =
                      "/login";
                  }}
                  className="text-left text-xs tracking-[0.15em]"
                >
                  SIGN IN
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* HERO */}
      <section id="home" className="relative">
        <div className="relative h-[72vh] min-h-[600px] overflow-hidden bg-black">
          <video
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            poster="/hero-poster.jpg"
          >
            <source
              src="/hero.mp4"
              type="video/mp4"
            />
          </video>

          <div className="absolute inset-0 bg-black/35" />

          <div className="relative z-10 flex h-full items-end px-6 pb-16 lg:px-16 lg:pb-20">
            <div className="max-w-2xl text-white">
              <p className="mb-5 text-xs tracking-[0.35em]">
                FHUSHDESIGNS
              </p>

              <h1 className="text-5xl font-light leading-[0.95] tracking-tight sm:text-6xl lg:text-8xl">
                Modesty,
                <br />
                beautifully
                <br />
                defined.
              </h1>

              <p className="mt-7 max-w-lg text-sm leading-7 text-white/80">
                Thoughtfully designed ready-to-wear
                pieces for the modern woman who
                values elegance, confidence and
                effortless style.
              </p>

              <button
                onClick={() =>
                  scrollToSection("shop")
                }
                className="mt-8 border border-white bg-white px-7 py-4 text-xs tracking-[0.2em] text-black transition hover:bg-transparent hover:text-white"
              >
                SHOP THE COLLECTION
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* BRAND INTRO */}
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <div className="max-w-3xl">
          <p className="text-xs tracking-[0.3em] text-black/50">
            THE FHUSHDESIGNS APPROACH
          </p>

          <h2 className="mt-5 text-3xl font-light leading-tight sm:text-5xl">
            Wear Fhush. Wear confidence.
          </h2>

          <p className="mt-7 max-w-2xl text-sm leading-8 text-black/60">
            FhushDesigns creates refined, modest pieces designed for real life.
            From the office to special occasions, every silhouette is created to
            help you feel polished, confident and completely yourself.
          </p>
        </div>
      </section>

      {/* COLLECTIONS */}
      <section
        id="collections"
        className="border-y border-black/10"
      >
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs tracking-[0.3em] text-black/50">
                EXPLORE
              </p>

              <h2 className="mt-3 text-3xl font-light sm:text-4xl">
                Shop by category
              </h2>
            </div>

            <button
              onClick={() =>
                scrollToSection("shop")
              }
              className="hidden text-xs tracking-[0.15em] underline underline-offset-8 sm:block"
            >
              VIEW ALL
            </button>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                "Two-Piece",
                "/products/office-two-piece.jpg",
              ],
              [
                "Dresses",
                "/products/maxi-dress.jpg",
              ],
              [
                "Tops",
                "/products/structured-blouse.jpg",
              ],
              [
                "Sets",
                "/products/ready-to-wear-set.jpg",
              ],
            ].map(([category, image]) => (
              <button
                key={category}
                onClick={() =>
                  scrollToSection("shop")
                }
                className="group relative h-[420px] overflow-hidden bg-black text-left"
              >
                <img
                  src={image}
                  alt={category}
                  className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-black/20 transition group-hover:bg-black/35" />

                <div className="absolute bottom-0 left-0 p-6 text-white">
                  <p className="text-xl font-light">
                    {category}
                  </p>

                  <p className="mt-2 text-[10px] tracking-[0.2em] opacity-80">
                    SHOP NOW
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* SHOP */}
      <section
        id="shop"
        className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28"
      >
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs tracking-[0.3em] text-black/50">
              THE COLLECTION
            </p>

            <h2 className="mt-3 text-3xl font-light sm:text-4xl">
              Bestsellers
            </h2>
          </div>
        </div>

        <div className="mt-12 grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {displayedProducts.map(
            (product) => (
              <article
                key={product.id}
                className="group"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-[#e8e4dc]">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />

                  <button
                    onClick={() =>
                      addToCart(product)
                    }
                    className="absolute bottom-4 left-4 right-4 bg-white px-5 py-4 text-xs tracking-[0.18em] opacity-0 transition group-hover:opacity-100"
                  >
                    ADD TO BAG
                  </button>
                </div>

                <div className="mt-5 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm">
                      {product.name}
                    </h3>

                    <p className="mt-2 text-xs text-black/50">
                      {product.category}
                    </p>
                  </div>

                  <p className="whitespace-nowrap text-sm">
                    {formatPrice(
                      product.price
                    )}
                  </p>
                </div>

                <button
                  onClick={() =>
                    addToCart(product)
                  }
                  className="mt-4 text-xs tracking-[0.15em] underline underline-offset-8 md:hidden"
                >
                  ADD TO BAG
                </button>
              </article>
            )
          )}
        </div>
      </section>

      {/* OUR STORY */}
      <section
        id="story"
        className="border-y border-black/10"
      >
        <div className="mx-auto grid max-w-7xl lg:grid-cols-2">
          <div className="min-h-[550px] overflow-hidden bg-[#e8e4dc]">
            <img
              src="/products/our-story.png"
              alt="The FhushDesigns story"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex items-center px-6 py-16 lg:px-16 lg:py-24">
            <div>
              <p className="text-xs tracking-[0.3em] text-black/50">
                OUR STORY
              </p>

              <h2 className="mt-5 text-4xl font-light leading-tight sm:text-5xl">
                Designed with intention.
              </h2>

              <p className="mt-7 text-sm leading-8 text-black/60">
                FhushDesigns was created for women
                who want clothing that feels
                sophisticated without compromising
                comfort or modesty.
              </p>

              <p className="mt-5 text-sm leading-8 text-black/60">
                Every piece is thoughtfully selected
                to create an effortless wardrobe
                filled with timeless silhouettes,
                considered details and confident
                femininity.
              </p>

              <button
                onClick={() =>
                  scrollToSection("shop")
                }
                className="mt-8 border border-black px-7 py-4 text-xs tracking-[0.18em] transition hover:bg-black hover:text-white"
              >
                DISCOVER FHUSHDESIGNS
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid gap-12 md:grid-cols-3">
          <div>
            <p className="text-xs tracking-[0.25em] text-black/40">
              01
            </p>

            <h3 className="mt-4 text-xl font-light">
              Thoughtful Design
            </h3>

            <p className="mt-4 text-sm leading-7 text-black/60">
              Clean silhouettes and considered
              details designed to remain relevant
              beyond a single season.
            </p>
          </div>

          <div>
            <p className="text-xs tracking-[0.25em] text-black/40">
              02
            </p>

            <h3 className="mt-4 text-xl font-light">
              Effortless Elegance
            </h3>

            <p className="mt-4 text-sm leading-7 text-black/60">
              Pieces that make getting dressed feel
              simple, polished and confident.
            </p>
          </div>

          <div>
            <p className="text-xs tracking-[0.25em] text-black/40">
              03
            </p>

            <h3 className="mt-4 text-xl font-light">
              Made for Real Life
            </h3>

            <p className="mt-4 text-sm leading-7 text-black/60">
              Versatile wardrobe staples created to
              move with you from one moment to the
              next.
            </p>
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="bg-black px-6 py-20 text-white lg:px-10 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs tracking-[0.3em] text-white/50">
            STAY CONNECTED
          </p>

          <h2 className="mt-5 text-4xl font-light sm:text-5xl">
            Join the FhushDesigns list.
          </h2>

          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/60">
            Be the first to know about new
            collections, exclusive pieces and
            special updates.
          </p>

          <form
            onSubmit={
              handleNewsletterSubmit
            }
            className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row"
          >
            <input
              type="email"
              value={newsletterEmail}
              onChange={(event) =>
                setNewsletterEmail(
                  event.target.value
                )
              }
              placeholder="Your email address"
              className="min-h-[52px] flex-1 border border-white/30 bg-transparent px-5 text-sm text-white outline-none placeholder:text-white/40"
            />

            <button
              type="submit"
              className="min-h-[52px] bg-white px-7 text-xs tracking-[0.18em] text-black transition hover:bg-white/80"
            >
              SUBSCRIBE
            </button>
          </form>

          {newsletterMessage && (
            <p className="mt-5 text-sm text-white/70">
              {newsletterMessage}
            </p>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#f8f6f1] px-6 py-12 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-4">
          <div>
            <img
              src="/logo.png"
              alt="FhushDesigns"
              className="h-10 w-auto object-contain"
            />

            <p className="mt-5 max-w-xs text-sm leading-7 text-black/50">
              Modest fashion designed for the
              modern woman.
            </p>
          </div>

          <div>
            <p className="text-xs tracking-[0.2em]">
              SHOP
            </p>

            <div className="mt-5 flex flex-col gap-3 text-sm text-black/60">
              <button
                onClick={() =>
                  scrollToSection("shop")
                }
                className="text-left"
              >
                All Products
              </button>

              <button
                onClick={() =>
                  scrollToSection(
                    "collections"
                  )
                }
                className="text-left"
              >
                Collections
              </button>

              <button
                onClick={() =>
                  scrollToSection("shop")
                }
                className="text-left"
              >
                Bestsellers
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs tracking-[0.2em]">
              HELP
            </p>

            <div className="mt-5 flex flex-col gap-3 text-sm text-black/60">
              <button
                onClick={() =>
                  alert(
                    "Customer support will be connected soon."
                  )
                }
                className="text-left"
              >
                Contact
              </button>

              <button
                onClick={() =>
                  alert(
                    "Shipping information will be available soon."
                  )
                }
                className="text-left"
              >
                Shipping
              </button>

              <button
                onClick={() =>
                  alert(
                    "Returns information will be available soon."
                  )
                }
                className="text-left"
              >
                Returns
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs tracking-[0.2em]">
              CONNECT
            </p>

            <div className="mt-5 flex flex-col gap-3 text-sm text-black/60">
              <button
                onClick={() =>
                  alert(
                    "Instagram will be connected soon."
                  )
                }
                className="text-left"
              >
                Instagram
              </button>

              <button
                onClick={() =>
                  alert(
                    "TikTok will be connected soon."
                  )
                }
                className="text-left"
              >
                TikTok
              </button>

              <button
                onClick={() =>
                  alert(
                    "Pinterest will be connected soon."
                  )
                }
                className="text-left"
              >
                Pinterest
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-7xl border-t border-black/10 pt-6 text-xs text-black/40">
          © {new Date().getFullYear()}{" "}
          FhushDesigns. All rights reserved.
        </div>
      </footer>

      {/* CART DRAWER */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50"
          onClick={() =>
            setCartOpen(false)
          }
        >
          <aside
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-[#f8f6f1]"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <h2 className="text-lg font-light">
                Your Bag
              </h2>

              <button
                onClick={() =>
                  setCartOpen(false)
                }
                className="text-xs tracking-widest"
              >
                CLOSE
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {cart.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-sm text-black/50">
                    Your bag is currently empty.
                  </p>

                  <button
                    onClick={() => {
                      setCartOpen(false);
                      scrollToSection(
                        "shop"
                      );
                    }}
                    className="mt-6 border border-black px-6 py-3 text-xs tracking-[0.15em]"
                  >
                    CONTINUE SHOPPING
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 border-b border-black/10 pb-6"
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-28 w-24 object-cover"
                      />

                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <p className="text-sm">
                            {item.name}
                          </p>

                          <p className="mt-2 text-xs text-black/50">
                            Quantity:{" "}
                            {item.quantity}
                          </p>
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-sm">
                            {formatPrice(
                              item.price *
                                item.quantity
                            )}
                          </p>

                          <button
                            onClick={() =>
                              removeFromCart(
                                item.id
                              )
                            }
                            className="text-xs text-black/50 underline underline-offset-4"
                          >
                            REMOVE
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-black/10 px-6 py-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    Subtotal
                  </span>

                  <span className="text-lg">
                    {formatPrice(cartTotal)}
                  </span>
                </div>

                <button
                  onClick={openCheckout}
                  className="mt-5 w-full bg-black px-6 py-4 text-xs tracking-[0.2em] text-white"
                >
                  PROCEED TO CHECKOUT
                </button>

                <button
                  onClick={() =>
                    setCartOpen(false)
                  }
                  className="mt-4 w-full border border-black px-6 py-4 text-xs tracking-[0.2em]"
                >
                  CONTINUE SHOPPING
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* CHECKOUT */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#f8f6f1]">
          <div className="mx-auto min-h-screen max-w-6xl px-6 py-8 lg:px-10">
            <div className="flex items-center justify-between border-b border-black/10 pb-6">
              <h1 className="text-2xl font-light">
                FhushDesigns Checkout
              </h1>

              {!orderPlaced && (
                <button
                  onClick={() =>
                    setCheckoutOpen(false)
                  }
                  className="text-xs tracking-widest"
                >
                  CLOSE
                </button>
              )}
            </div>

            {orderPlaced ? (
              <div className="flex min-h-[70vh] items-center justify-center">
                <div className="w-full max-w-xl text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-black text-2xl">
                    ✓
                  </div>

                  <p className="mt-7 text-xs tracking-[0.3em] text-black/50">
                    ORDER CONFIRMED
                  </p>

                  <h2 className="mt-4 text-4xl font-light">
                    Order received
                  </h2>

                  <p className="mt-5 text-sm leading-7 text-black/60">
                    Thank you,{" "}
                    {customerName}. Your
                    payment has been confirmed
                    and your order has been
                    successfully saved.
                  </p>

                  <p className="mt-5 text-2xl font-light">
                    {formatPrice(
                      confirmedOrderTotal
                    )}
                  </p>

                  <button
                    onClick={() => {
                      setCheckoutOpen(
                        false
                      );

                      setOrderPlaced(false);

                      setConfirmedOrderTotal(
                        0
                      );

                      setCustomerName("");
                      setCustomerEmail("");
                      setCustomerPhone("");
                      setCustomerAddress("");
                      setCustomerCity("");

                      scrollToSection(
                        "home"
                      );
                    }}
                    className="mt-8 bg-black px-8 py-4 text-xs tracking-[0.2em] text-white"
                  >
                    CONTINUE SHOPPING
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-12 py-10 lg:grid-cols-[1fr_400px]">
                <div>
                  <p className="text-xs tracking-[0.25em] text-black/50">
                    DELIVERY INFORMATION
                  </p>

                  <div className="mt-8 space-y-5">
                    <div>
                      <label className="mb-2 block text-xs tracking-wider">
                        FULL NAME
                      </label>

                      <input
                        type="text"
                        value={customerName}
                        onChange={(event) =>
                          setCustomerName(
                            event.target.value
                          )
                        }
                        className="w-full border border-black/20 bg-transparent px-4 py-4 text-sm outline-none focus:border-black"
                        placeholder="Your full name"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs tracking-wider">
                        EMAIL ADDRESS
                      </label>

                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(event) =>
                          setCustomerEmail(
                            event.target.value
                          )
                        }
                        className="w-full border border-black/20 bg-transparent px-4 py-4 text-sm outline-none focus:border-black"
                        placeholder="you@example.com"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs tracking-wider">
                        PHONE NUMBER
                      </label>

                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(event) =>
                          setCustomerPhone(
                            event.target.value
                          )
                        }
                        className="w-full border border-black/20 bg-transparent px-4 py-4 text-sm outline-none focus:border-black"
                        placeholder="0800 000 0000"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs tracking-wider">
                        DELIVERY ADDRESS
                      </label>

                      <textarea
                        value={customerAddress}
                        onChange={(event) =>
                          setCustomerAddress(
                            event.target.value
                          )
                        }
                        rows={4}
                        className="w-full resize-none border border-black/20 bg-transparent px-4 py-4 text-sm outline-none focus:border-black"
                        placeholder="Street address"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs tracking-wider">
                        CITY
                      </label>

                      <input
                        type="text"
                        value={customerCity}
                        onChange={(event) =>
                          setCustomerCity(
                            event.target.value
                          )
                        }
                        className="w-full border border-black/20 bg-transparent px-4 py-4 text-sm outline-none focus:border-black"
                        placeholder="City"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="border border-black/10 p-6">
                    <p className="text-xs tracking-[0.25em] text-black/50">
                      ORDER SUMMARY
                    </p>

                    <div className="mt-6 space-y-5">
                      {cart.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between gap-4 text-sm"
                        >
                          <div>
                            <p>
                              {item.name}
                            </p>

                            <p className="mt-1 text-xs text-black/50">
                              Qty:{" "}
                              {item.quantity}
                            </p>
                          </div>

                          <p className="whitespace-nowrap">
                            {formatPrice(
                              item.price *
                                item.quantity
                            )}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-7 border-t border-black/10 pt-6">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">
                          Total
                        </span>

                        <span className="text-xl">
                          {formatPrice(
                            cartTotal
                          )}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={placeOrder}
                      disabled={placingOrder}
                      className="mt-7 w-full bg-black px-6 py-4 text-xs tracking-[0.2em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {placingOrder
                        ? "PROCESSING PAYMENT..."
                        : "PAY WITH PAYSTACK"}
                    </button>

                    <p className="mt-4 text-center text-[11px] leading-5 text-black/40">
                      Your payment is securely
                      processed by Paystack.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}